#!/bin/sh
# Әр жаңартудан кейін іске қосыңыз — браузерлер ескі файлдарды кэштен алмайды
V=$(date +%Y%m%d%H%M)
sed -i -E "s#(href=\"css/style\.css)(\?v=[0-9]+)?\"#\1?v=$V\"#; s#(src=\"js/[a-z/]+\.js)(\?v=[0-9]+)?\"#\1?v=$V\"#g" index.html
sed -i -E "s#import\(\"\./cloud\.js(\?v=[0-9]+)?\"\)#import(\"./cloud.js?v=$V\")#" js/app.js
echo "version $V"
