// Non-Windows placeholder so node-gyp produces a loadable (but unused) module
// on Linux/macOS CI. The TS layer never calls into it off Windows.
#include <napi.h>

Napi::Object Init(Napi::Env env, Napi::Object exports) { return exports; }
NODE_API_MODULE(tpm_native, Init)
