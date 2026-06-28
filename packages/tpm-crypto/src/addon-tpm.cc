// Windows CNG Platform Crypto Provider addon.
// Exposes openOrCreateKey / getPublicKeyComponents / decrypt to JavaScript.
// The RSA private key is created/persisted inside the TPM (MS_PLATFORM_CRYPTO_PROVIDER)
// and is non-exportable; decryption happens in hardware via NCryptDecrypt.
#include <napi.h>
#include <windows.h>
#include <ncrypt.h>
#include <bcrypt.h>
#include <string>
#include <vector>

// Persistent handles shared across all JS calls within one Node process lifetime.
// The private key lives in the TPM — only its handle is held here.
static NCRYPT_PROV_HANDLE g_prov = 0;
static NCRYPT_KEY_HANDLE  g_key  = 0;

// Converts a UTF-8 std::string to a wide string for the CNG APIs.
static std::wstring ToWide(const std::string& s) {
  if (s.empty()) return std::wstring();
  int n = MultiByteToWideChar(CP_UTF8, 0, s.c_str(), -1, nullptr, 0);
  std::wstring w(static_cast<size_t>(n), L'\0');
  MultiByteToWideChar(CP_UTF8, 0, s.c_str(), -1, &w[0], n);
  // MultiByteToWideChar includes the null terminator in the count; strip it.
  if (!w.empty() && w.back() == L'\0') w.pop_back();
  return w;
}

// ---------------------------------------------------------------------------
// openOrCreateKey(keyName: string): Promise<void>
// Opens an existing persisted RSA-2048 key in the TPM, or creates one if it
// does not yet exist. The key is set non-exportable (NCRYPT_EXPORT_POLICY = 0).
// ---------------------------------------------------------------------------
class OpenCreateWorker : public Napi::AsyncWorker {
 public:
  OpenCreateWorker(Napi::Promise::Deferred d, std::wstring name)
      : Napi::AsyncWorker(d.Env()), deferred_(d), name_(std::move(name)) {}

  void Execute() override {
    SECURITY_STATUS st;

    // Open the PCP storage provider once per process.
    if (g_prov == 0) {
      st = NCryptOpenStorageProvider(&g_prov, MS_PLATFORM_CRYPTO_PROVIDER, 0);
      if (st != ERROR_SUCCESS) {
        SetError("NCryptOpenStorageProvider failed: status " + std::to_string(st));
        return;
      }
    }

    // Release any previously held key handle before opening/creating a new one.
    if (g_key != 0) {
      NCryptFreeObject(g_key);
      g_key = 0;
    }

    // Try to open an existing persisted key first (open-if-exists semantics).
    st = NCryptOpenKey(g_prov, &g_key, name_.c_str(), 0, 0);
    if (st == ERROR_SUCCESS) return;  // key already exists — done

    // Key does not exist; create a new RSA-2048 key persisted by name.
    st = NCryptCreatePersistedKey(g_prov, &g_key, BCRYPT_RSA_ALGORITHM, name_.c_str(), 0, 0);
    if (st != ERROR_SUCCESS) {
      SetError("NCryptCreatePersistedKey failed: status " + std::to_string(st));
      return;
    }

    // Set key length to 2048 bits.
    DWORD bits = 2048;
    st = NCryptSetProperty(g_key, NCRYPT_LENGTH_PROPERTY,
                           reinterpret_cast<PBYTE>(&bits), sizeof(bits), 0);
    if (st != ERROR_SUCCESS) {
      SetError("NCryptSetProperty(key length) failed: status " + std::to_string(st));
      return;
    }

    // Clear export policy so the private key is non-exportable.
    DWORD policy = 0;
    NCryptSetProperty(g_key, NCRYPT_EXPORT_POLICY_PROPERTY,
                      reinterpret_cast<PBYTE>(&policy), sizeof(policy), 0);

    // Finalize (generate) the key inside the TPM.
    st = NCryptFinalizeKey(g_key, 0);
    if (st != ERROR_SUCCESS) {
      SetError("NCryptFinalizeKey failed: status " + std::to_string(st));
      return;
    }
  }

  void OnOK()    override { deferred_.Resolve(Env().Undefined()); }
  void OnError(const Napi::Error& e) override { deferred_.Reject(e.Value()); }

 private:
  Napi::Promise::Deferred deferred_;
  std::wstring name_;
};

Napi::Value OpenOrCreateKey(const Napi::CallbackInfo& info) {
  auto d = Napi::Promise::Deferred::New(info.Env());
  auto name = ToWide(info[0].As<Napi::String>().Utf8Value());
  (new OpenCreateWorker(d, std::move(name)))->Queue();
  return d.Promise();
}

// ---------------------------------------------------------------------------
// getPublicKeyComponents(): Promise<{ modulus: Buffer; exponent: Buffer }>
// Exports the BCRYPT_RSAPUBLIC_BLOB from the TPM key and slices out the
// public exponent and modulus.
//
// BCRYPT_RSAPUBLIC_BLOB layout (from bcrypt.h):
//   BCRYPT_RSAKEY_BLOB header
//   PublicExponent  (cbPublicExp bytes, big-endian)
//   Modulus         (cbModulus  bytes, big-endian)
// ---------------------------------------------------------------------------
class PublicWorker : public Napi::AsyncWorker {
 public:
  explicit PublicWorker(Napi::Promise::Deferred d)
      : Napi::AsyncWorker(d.Env()), deferred_(d) {}

  void Execute() override {
    if (g_key == 0) {
      SetError("no key open; call openOrCreateKey first");
      return;
    }

    // First call: determine required buffer size.
    DWORD cb = 0;
    SECURITY_STATUS st = NCryptExportKey(
        g_key, 0, BCRYPT_RSAPUBLIC_BLOB, nullptr, nullptr, 0, &cb, 0);
    if (st != ERROR_SUCCESS) {
      SetError("NCryptExportKey (size query) failed: status " + std::to_string(st));
      return;
    }

    blob_.resize(cb);

    // Second call: export the actual public blob.
    st = NCryptExportKey(
        g_key, 0, BCRYPT_RSAPUBLIC_BLOB, nullptr, blob_.data(), cb, &cb, 0);
    if (st != ERROR_SUCCESS) {
      SetError("NCryptExportKey failed: status " + std::to_string(st));
      return;
    }

    // Parse the header, then slice out exponent and modulus.
    auto* hdr = reinterpret_cast<BCRYPT_RSAKEY_BLOB*>(blob_.data());
    size_t off = sizeof(BCRYPT_RSAKEY_BLOB);
    exp_.assign(blob_.begin() + static_cast<ptrdiff_t>(off),
                blob_.begin() + static_cast<ptrdiff_t>(off + hdr->cbPublicExp));
    off += hdr->cbPublicExp;
    mod_.assign(blob_.begin() + static_cast<ptrdiff_t>(off),
                blob_.begin() + static_cast<ptrdiff_t>(off + hdr->cbModulus));
  }

  void OnOK() override {
    auto obj = Napi::Object::New(Env());
    obj.Set("modulus",  Napi::Buffer<uint8_t>::Copy(Env(), mod_.data(), mod_.size()));
    obj.Set("exponent", Napi::Buffer<uint8_t>::Copy(Env(), exp_.data(), exp_.size()));
    deferred_.Resolve(obj);
  }
  void OnError(const Napi::Error& e) override { deferred_.Reject(e.Value()); }

 private:
  Napi::Promise::Deferred deferred_;
  std::vector<uint8_t> blob_, mod_, exp_;
};

Napi::Value GetPublicKeyComponents(const Napi::CallbackInfo& info) {
  auto d = Napi::Promise::Deferred::New(info.Env());
  (new PublicWorker(d))->Queue();
  return d.Promise();
}

// ---------------------------------------------------------------------------
// decrypt(ciphertext: Buffer): Promise<Buffer>
// Decrypts an RSA-OAEP-SHA256 ciphertext entirely inside the TPM hardware.
// ---------------------------------------------------------------------------
class DecryptWorker : public Napi::AsyncWorker {
 public:
  DecryptWorker(Napi::Promise::Deferred d, std::vector<uint8_t> in)
      : Napi::AsyncWorker(d.Env()), deferred_(d), in_(std::move(in)) {}

  void Execute() override {
    if (g_key == 0) {
      SetError("no key open; call openOrCreateKey first");
      return;
    }

    // OAEP padding descriptor with SHA-256 as the hash algorithm.
    BCRYPT_OAEP_PADDING_INFO pad{};
    pad.pszAlgId = BCRYPT_SHA256_ALGORITHM;
    pad.pbLabel  = nullptr;
    pad.cbLabel  = 0;

    // First call: determine the plaintext size.
    DWORD cb = 0;
    SECURITY_STATUS st = NCryptDecrypt(
        g_key,
        in_.data(), static_cast<DWORD>(in_.size()),
        &pad,
        nullptr, 0,
        &cb,
        NCRYPT_PAD_OAEP_FLAG);
    if (st != ERROR_SUCCESS) {
      SetError("NCryptDecrypt (size query) failed: status " + std::to_string(st));
      return;
    }

    out_.resize(cb);

    // Second call: perform the actual decryption inside the TPM.
    st = NCryptDecrypt(
        g_key,
        in_.data(), static_cast<DWORD>(in_.size()),
        &pad,
        out_.data(), cb,
        &cb,
        NCRYPT_PAD_OAEP_FLAG);
    if (st != ERROR_SUCCESS) {
      SetError("NCryptDecrypt failed: status " + std::to_string(st));
      return;
    }

    out_.resize(cb);  // trim to actual plaintext length
  }

  void OnOK() override {
    deferred_.Resolve(
        Napi::Buffer<uint8_t>::Copy(Env(), out_.data(), out_.size()));
  }
  void OnError(const Napi::Error& e) override { deferred_.Reject(e.Value()); }

 private:
  Napi::Promise::Deferred deferred_;
  std::vector<uint8_t> in_, out_;
};

Napi::Value Decrypt(const Napi::CallbackInfo& info) {
  auto buf = info[0].As<Napi::Buffer<uint8_t>>();
  std::vector<uint8_t> in(buf.Data(), buf.Data() + buf.Length());
  auto d = Napi::Promise::Deferred::New(info.Env());
  (new DecryptWorker(d, std::move(in)))->Queue();
  return d.Promise();
}

// ---------------------------------------------------------------------------
// Module init: export the three CNG functions.
// ---------------------------------------------------------------------------
Napi::Object Init(Napi::Env env, Napi::Object exports) {
  exports.Set("openOrCreateKey",       Napi::Function::New(env, OpenOrCreateKey));
  exports.Set("getPublicKeyComponents", Napi::Function::New(env, GetPublicKeyComponents));
  exports.Set("decrypt",               Napi::Function::New(env, Decrypt));
  return exports;
}

NODE_API_MODULE(tpm_native, Init)
