#
# cmake file
#

#
# Note: we're not using this currently. To build, run the "buildme" script
#


### TODO: invoke swig
### C:\swigwin-3.0.8\swig.exe -Wall -c++ -javascript -node ../testlib.i

# http://www.swig.org/Doc1.3/Introduction.html

CMAKE_MINIMUM_REQUIRED(VERSION 2.8.11)

set (PROJ_NAME elementApp)
PROJECT(${PROJ_NAME})

## for webby stuff (html, js, css)
set (HTML index.html)
set (JS app/js/app.js
        app/js/data.js
        app/js/events.js
        app/js/features.js
        app/js/plotView.js
        app/js/plotTree.js
        app/js/serial.js
        app/js/startup.js)
set (CSS app/css/style.css)

source_group("html" FILES ${HTML})
source_group("js" FILES ${JS})
source_group("css" FILES ${CSS})

# http://stackoverflow.com/questions/12272832/cmake-compiling-python-into-build-folder
#macro(add_web_target tgt)
#  foreach(file ${ARGN})
#    set(OUT ${CMAKE_CURRENT_BINARY_DIR}/${file}) # ?
#    list(APPEND OUT_FILES ${OUT})
#    add_custom_command(OUTPUT ${OUT} COMMAND cmake -E touch ${OUT})
#  endforeach()
#
#  add_custom_target(${tgt} ALL DEPENDS ${OUT_FILES} SOURCES ${OUT_FILES})
#endmacro()
#                          
#add_web_target(ElementAppWebFiles ${HTML} ${JS} ${CSS})
add_custom_command(TARGET ${PROJ_NAME} COMMAND cmake -E touch ${HTML})
add_custom_target(${PROJ_NAME} ALL DEPENDS ${HTML} ${JS} ${CSS} SOURCES ${HTML} ${JS} ${CSS} SOURCES)




## building native node module (not yet)
if(CMAKE_COMPILER_IS_GNUCC OR CMAKE_COMPILER_IS_GNUCXX OR CMAKE_CXX_COMPILER_ID MATCHES "Clang")
  add_compile_options(-std=c++1y)
endif()

set (SRC testlib.cpp)
set (INCLUDE testlib.h)
set (SWIGINTERFACES testlib.i)
set (BINDINGS binding.gyp)
                   
source_group("src" FILES ${SRC})
source_group("include" FILES ${INCLUDE})
source_group("interface" FILES ${SWIGINTERFACES} ${BINDINGS})

#add_library(${PROJ_NAME} SHARED ${SRC} ${INCLUDE} ${TCC})
#target_link_libraries(${PROJ_NAME})

## SWIG -- need this on my Windows machine
# set (SWIG_EXECUTABLE "C:/swigwin-3.0.8/swig.exe")


### FOR JAVASCRIPT VERSION
# http://stackoverflow.com/questions/9629677/how-can-i-use-a-c-library-from-node-js

# swig -c++ -javascript -node testlib.i
# nody-gyp configure (sometimes)
# node-gyp build
#
# or, just do this: node-gyp configure build
#

# can tell SWIG which version of v8 to use via:
#  $ swig -c++ -javascript -v8 -DV8_VERSION=0x032530 example.i  (here, version 3.25.30)

# HOME=~/.electron-gyp node-gyp rebuild --target=0.36.7 --arch=x64 --dist-url=https://atom.io/download/atom-shell

### random help:
# http://www.swig.org/Doc3.0/Javascript.html#Javascript_known_issues
# http://www.swig.org/Doc3.0/Javascript.html#Javascript_examples

# JAVASCRIPT VERSION
find_package(SWIG REQUIRED)
include(${SWIG_USE_FILE})

include_directories(${CMAKE_CURRENT_SOURCE_DIR})

set(CMAKE_SWIG_FLAGS "-node")

set_source_files_properties(testlib.i PROPERTIES CPLUSPLUS ON)
set_source_files_properties(testlib.i PROPERTIES SWIG_FLAGS "-includeall")
# swig_add_module(testlib javascript testlib.i ${SRC})


# after swig, we want to invoke node-gyp and element-rebuild

# useful variables:
# CMAKE_SWIG_OUTDIR
# CMAKE_SWIG_FLAGS
# SWIG_MODULE_<name>_EXTRA_DEPS
# ${SWIG_MODULE_${name}_REAL_NAME}
# 

# ??? This doesn't work for python mode
#swig_link_libraries(testlib ${PYTHON_LIBRARIES})

