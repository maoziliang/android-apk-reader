bundle: apk2xml.bundle.js resource.bundle.js 

apk2xml.bundle.js: apk2xml.js
	browserify apk2xml.js -s apk2xml -o apk2xml.bundle.js
resource.bundle.js: resource.js
	browserify resource.js -s resource -o resource.bundle.js

clean:
	@rm -f *.bundle.js
