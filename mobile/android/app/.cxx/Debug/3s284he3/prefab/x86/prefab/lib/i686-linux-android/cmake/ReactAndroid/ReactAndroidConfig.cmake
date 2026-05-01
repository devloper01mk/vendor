if(NOT TARGET ReactAndroid::hermestooling)
add_library(ReactAndroid::hermestooling SHARED IMPORTED)
set_target_properties(ReactAndroid::hermestooling PROPERTIES
    IMPORTED_LOCATION "/private/var/folders/77/y8k5g0qj20j09_yh0v04l6jm0000gp/T/cursor-sandbox-cache/ac140829e3bff4e7a31745c713c7358c/gradle/caches/8.10.2/transforms/e7a87e28456e3cd3dea6e54dbe4d1714/transformed/react-android-0.76.3-debug/prefab/modules/hermestooling/libs/android.x86/libhermestooling.so"
    INTERFACE_INCLUDE_DIRECTORIES "/private/var/folders/77/y8k5g0qj20j09_yh0v04l6jm0000gp/T/cursor-sandbox-cache/ac140829e3bff4e7a31745c713c7358c/gradle/caches/8.10.2/transforms/e7a87e28456e3cd3dea6e54dbe4d1714/transformed/react-android-0.76.3-debug/prefab/modules/hermestooling/include"
    INTERFACE_LINK_LIBRARIES ""
)
endif()

if(NOT TARGET ReactAndroid::jsctooling)
add_library(ReactAndroid::jsctooling SHARED IMPORTED)
set_target_properties(ReactAndroid::jsctooling PROPERTIES
    IMPORTED_LOCATION "/private/var/folders/77/y8k5g0qj20j09_yh0v04l6jm0000gp/T/cursor-sandbox-cache/ac140829e3bff4e7a31745c713c7358c/gradle/caches/8.10.2/transforms/e7a87e28456e3cd3dea6e54dbe4d1714/transformed/react-android-0.76.3-debug/prefab/modules/jsctooling/libs/android.x86/libjsctooling.so"
    INTERFACE_INCLUDE_DIRECTORIES "/private/var/folders/77/y8k5g0qj20j09_yh0v04l6jm0000gp/T/cursor-sandbox-cache/ac140829e3bff4e7a31745c713c7358c/gradle/caches/8.10.2/transforms/e7a87e28456e3cd3dea6e54dbe4d1714/transformed/react-android-0.76.3-debug/prefab/modules/jsctooling/include"
    INTERFACE_LINK_LIBRARIES ""
)
endif()

if(NOT TARGET ReactAndroid::jsi)
add_library(ReactAndroid::jsi SHARED IMPORTED)
set_target_properties(ReactAndroid::jsi PROPERTIES
    IMPORTED_LOCATION "/private/var/folders/77/y8k5g0qj20j09_yh0v04l6jm0000gp/T/cursor-sandbox-cache/ac140829e3bff4e7a31745c713c7358c/gradle/caches/8.10.2/transforms/e7a87e28456e3cd3dea6e54dbe4d1714/transformed/react-android-0.76.3-debug/prefab/modules/jsi/libs/android.x86/libjsi.so"
    INTERFACE_INCLUDE_DIRECTORIES "/private/var/folders/77/y8k5g0qj20j09_yh0v04l6jm0000gp/T/cursor-sandbox-cache/ac140829e3bff4e7a31745c713c7358c/gradle/caches/8.10.2/transforms/e7a87e28456e3cd3dea6e54dbe4d1714/transformed/react-android-0.76.3-debug/prefab/modules/jsi/include"
    INTERFACE_LINK_LIBRARIES ""
)
endif()

if(NOT TARGET ReactAndroid::reactnative)
add_library(ReactAndroid::reactnative SHARED IMPORTED)
set_target_properties(ReactAndroid::reactnative PROPERTIES
    IMPORTED_LOCATION "/private/var/folders/77/y8k5g0qj20j09_yh0v04l6jm0000gp/T/cursor-sandbox-cache/ac140829e3bff4e7a31745c713c7358c/gradle/caches/8.10.2/transforms/e7a87e28456e3cd3dea6e54dbe4d1714/transformed/react-android-0.76.3-debug/prefab/modules/reactnative/libs/android.x86/libreactnative.so"
    INTERFACE_INCLUDE_DIRECTORIES "/private/var/folders/77/y8k5g0qj20j09_yh0v04l6jm0000gp/T/cursor-sandbox-cache/ac140829e3bff4e7a31745c713c7358c/gradle/caches/8.10.2/transforms/e7a87e28456e3cd3dea6e54dbe4d1714/transformed/react-android-0.76.3-debug/prefab/modules/reactnative/include"
    INTERFACE_LINK_LIBRARIES ""
)
endif()

