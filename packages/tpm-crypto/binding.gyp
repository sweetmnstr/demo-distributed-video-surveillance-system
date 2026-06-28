{
  "targets": [
    {
      "target_name": "tpm_native",
      "include_dirs": ["<!@(node -p \"require('node-addon-api').include\")"],
      "defines": ["NAPI_DISABLE_CPP_EXCEPTIONS"],
      "conditions": [
        ["OS=='win'", {
          "sources": ["src/addon-tpm.cc"],
          "libraries": ["ncrypt.lib"],
          "msvs_settings": { "VCCLCompilerTool": { "AdditionalOptions": ["/std:c++17"] } }
        }],
        ["OS!='win'", {
          "sources": ["src/addon-tpm-stub.cc"]
        }]
      ]
    }
  ]
}
