#include <napi.h>
#include <openssl/evp.h>
#include <openssl/pem.h>
#include <openssl/rsa.h>
#include <string>
#include <vector>

// A single RSA key pair held for the addon's lifetime. The private key never
// leaves this process; only getPublicKey() and decrypt results are exposed.
static EVP_PKEY* g_key = nullptr;

// --- generateKeyPair (async) ---
class GenerateWorker : public Napi::AsyncWorker {
 public:
  explicit GenerateWorker(Napi::Promise::Deferred deferred)
      : Napi::AsyncWorker(deferred.Env()), deferred_(deferred) {}
  void Execute() override {
    EVP_PKEY_CTX* ctx = EVP_PKEY_CTX_new_id(EVP_PKEY_RSA, nullptr);
    if (!ctx || EVP_PKEY_keygen_init(ctx) <= 0 ||
        EVP_PKEY_CTX_set_rsa_keygen_bits(ctx, 2048) <= 0) {
      if (ctx) EVP_PKEY_CTX_free(ctx);
      SetError("keygen init failed");
      return;
    }
    if (g_key) { EVP_PKEY_free(g_key); g_key = nullptr; }
    if (EVP_PKEY_keygen(ctx, &g_key) <= 0) { SetError("keygen failed"); }
    EVP_PKEY_CTX_free(ctx);
  }
  void OnOK() override { deferred_.Resolve(Env().Undefined()); }
  void OnError(const Napi::Error& e) override { deferred_.Reject(e.Value()); }
 private:
  Napi::Promise::Deferred deferred_;
};

Napi::Value GenerateKeyPair(const Napi::CallbackInfo& info) {
  auto deferred = Napi::Promise::Deferred::New(info.Env());
  (new GenerateWorker(deferred))->Queue();
  return deferred.Promise();
}

// --- getPublicKey (async) ---
class PublicKeyWorker : public Napi::AsyncWorker {
 public:
  explicit PublicKeyWorker(Napi::Promise::Deferred deferred)
      : Napi::AsyncWorker(deferred.Env()), deferred_(deferred) {}
  void Execute() override {
    if (!g_key) { SetError("no key; call generateKeyPair first"); return; }
    BIO* bio = BIO_new(BIO_s_mem());
    if (!PEM_write_bio_PUBKEY(bio, g_key)) { BIO_free(bio); SetError("pem export failed"); return; }
    char* data = nullptr;
    long len = BIO_get_mem_data(bio, &data);
    pem_.assign(data, static_cast<size_t>(len));
    BIO_free(bio);
  }
  void OnOK() override { deferred_.Resolve(Napi::String::New(Env(), pem_)); }
  void OnError(const Napi::Error& e) override { deferred_.Reject(e.Value()); }
 private:
  Napi::Promise::Deferred deferred_;
  std::string pem_;
};

Napi::Value GetPublicKey(const Napi::CallbackInfo& info) {
  auto deferred = Napi::Promise::Deferred::New(info.Env());
  (new PublicKeyWorker(deferred))->Queue();
  return deferred.Promise();
}

// --- decryptWithPrivateKey (async) ---
class DecryptWorker : public Napi::AsyncWorker {
 public:
  DecryptWorker(Napi::Promise::Deferred deferred, std::vector<uint8_t> input)
      : Napi::AsyncWorker(deferred.Env()), deferred_(deferred), input_(std::move(input)) {}
  void Execute() override {
    if (!g_key) { SetError("no key; call generateKeyPair first"); return; }
    EVP_PKEY_CTX* ctx = EVP_PKEY_CTX_new(g_key, nullptr);
    if (!ctx || EVP_PKEY_decrypt_init(ctx) <= 0 ||
        EVP_PKEY_CTX_set_rsa_padding(ctx, RSA_PKCS1_OAEP_PADDING) <= 0 ||
        EVP_PKEY_CTX_set_rsa_oaep_md(ctx, EVP_sha256()) <= 0) {
      if (ctx) EVP_PKEY_CTX_free(ctx);
      SetError("decrypt init failed");
      return;
    }
    size_t outLen = 0;
    if (EVP_PKEY_decrypt(ctx, nullptr, &outLen, input_.data(), input_.size()) <= 0) {
      EVP_PKEY_CTX_free(ctx); SetError("decrypt size failed"); return;
    }
    output_.resize(outLen);
    if (EVP_PKEY_decrypt(ctx, output_.data(), &outLen, input_.data(), input_.size()) <= 0) {
      EVP_PKEY_CTX_free(ctx); SetError("decrypt failed"); return;
    }
    output_.resize(outLen);
    EVP_PKEY_CTX_free(ctx);
  }
  void OnOK() override {
    deferred_.Resolve(Napi::Buffer<uint8_t>::Copy(Env(), output_.data(), output_.size()));
  }
  void OnError(const Napi::Error& e) override { deferred_.Reject(e.Value()); }
 private:
  Napi::Promise::Deferred deferred_;
  std::vector<uint8_t> input_;
  std::vector<uint8_t> output_;
};

Napi::Value DecryptWithPrivateKey(const Napi::CallbackInfo& info) {
  auto buf = info[0].As<Napi::Buffer<uint8_t>>();
  std::vector<uint8_t> input(buf.Data(), buf.Data() + buf.Length());
  auto deferred = Napi::Promise::Deferred::New(info.Env());
  (new DecryptWorker(deferred, std::move(input)))->Queue();
  return deferred.Promise();
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
  exports.Set("generateKeyPair", Napi::Function::New(env, GenerateKeyPair));
  exports.Set("getPublicKey", Napi::Function::New(env, GetPublicKey));
  exports.Set("decryptWithPrivateKey", Napi::Function::New(env, DecryptWithPrivateKey));
  return exports;
}

NODE_API_MODULE(native_crypto, Init)
