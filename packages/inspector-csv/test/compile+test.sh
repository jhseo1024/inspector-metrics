#!/bin/bash

mkdir -p /opt/inspector-csv/.tmp/$NODE_VERSION/
rsync -avh --exclude *.sh \
    lib \
    test \
    package.json \
    tsconfig.json \
    tslint.json \
    mocha.opts \
    /opt/inspector-csv/.tmp/$NODE_VERSION/ \
    --delete
cd /opt/inspector-csv/.tmp/$NODE_VERSION/
npm i
npm run build
