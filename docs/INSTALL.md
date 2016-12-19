Prerequisites for using Element with native modules
===================================================

- SWIG
- node.js
- node-gyp 
- electron
- electron-rebuild
- d3 node.js module
- serial node.js module (modified for electron)
- the FeatureExtraction library

How to install requirements on Windows
--------------------------------------

-   SWIG  
Download the Windows zip file from swig.org's [download section](http://www.swig.org/download.html). Unzip this directory
and put it somewhere convenient (I used C:\swigwin-3.0.8). Make sure you set your PATH environment
variable to include the swigwin directory.

- node.js 4.3.2  
Download from [https://nodejs.org]. Node.js installs npm, the node package manager

- node-gyp  
npm install -g node-gyp

- electron  
npm install electron-prebuilt -g

- electron-rebuild  
npm install --save-dev electron-rebuild   (note to self: what is save-dev?)

- d3  
npm install d3

- serial  
???


How to install requirements on OS X
-----------------------------------

- SWIG  
homebrew install swig

- node.js  
homebrew install node (got version 5.0.0) --- this installs node and
npm (node package manager)

- node-gyp  
npm install -g node-gyp

- electron  
npm install electron-prebuilt -g

- electron-rebuild  
npm install --save-dev electron-rebuild   (what is save-dev?)

- d3  
npm install d3

- serial  
???


How to install requirements on Linux
------------------------------------

- SWIG  
apt-get swig

- node.js  
apt-get node

- node-gyp  
npm install -g node-gyp

- electron  
npm install electron-prebuilt -g

- electron-rebuild  
npm install --save-dev electron-rebuild   (what is save-dev?)

- d3  
npm install d3

- serial  
???
