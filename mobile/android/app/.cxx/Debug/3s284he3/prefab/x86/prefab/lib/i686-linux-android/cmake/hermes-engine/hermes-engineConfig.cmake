if(NOT TARGET hermes-engine::libhermes)
add_library(hermes-engine::libhermes SHARED IMPORTED)
set_target_properties(hermes-engine::libhermes PROPERTIES
    IMPORTED_LOCATION "/private/var/folders/77/y8k5g0qj20j09_yh0v04l6jm0000gp/T/cursor-sandbox-cache/4cd1db2279a86c8e8c9243f46aab1301/gradle/caches/8.10.2/transforms/c7c01c5ba719d9104e6a8f76c2e0feba/transformed/hermes-android-0.76.3-debug/prefab/modules/libhermes/libs/android.x86/libhermes.so"
    INTERFACE_INCLUDE_DIRECTORIES "/private/var/folders/77/y8k5g0qj20j09_yh0v04l6jm0000gp/T/cursor-sandbox-cache/4cd1db2279a86c8e8c9243f46aab1301/gradle/caches/8.10.2/transforms/c7c01c5ba719d9104e6a8f76c2e0feba/transformed/hermes-android-0.76.3-debug/prefab/modules/libhermes/include"
    INTERFACE_LINK_LIBRARIES ""
)
endif()

