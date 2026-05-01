if(NOT TARGET hermes-engine::libhermes)
add_library(hermes-engine::libhermes SHARED IMPORTED)
set_target_properties(hermes-engine::libhermes PROPERTIES
    IMPORTED_LOCATION "/private/var/folders/77/y8k5g0qj20j09_yh0v04l6jm0000gp/T/cursor-sandbox-cache/ac140829e3bff4e7a31745c713c7358c/gradle/caches/8.10.2/transforms/d6d1c7a488269a3e16bdbb655ad449db/transformed/hermes-android-0.76.3-release/prefab/modules/libhermes/libs/android.armeabi-v7a/libhermes.so"
    INTERFACE_INCLUDE_DIRECTORIES "/private/var/folders/77/y8k5g0qj20j09_yh0v04l6jm0000gp/T/cursor-sandbox-cache/ac140829e3bff4e7a31745c713c7358c/gradle/caches/8.10.2/transforms/d6d1c7a488269a3e16bdbb655ad449db/transformed/hermes-android-0.76.3-release/prefab/modules/libhermes/include"
    INTERFACE_LINK_LIBRARIES ""
)
endif()

