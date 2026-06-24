{
  "targets": [
    {
      "target_name": "native_crypto",
      "sources": ["src/addon.cc"],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")",
        "<(node_root_dir)/deps/openssl/openssl/include"
      ],
      "defines": ["NAPI_DISABLE_CPP_EXCEPTIONS"],
      "cflags_cc": ["-std=c++17"],
      "conditions": [
        ["OS=='win'", { "msvs_settings": { "VCCLCompilerTool": { "AdditionalOptions": ["/std:c++17"] } } }]
      ]
    }
  ]
}
