if (typeof window == 'undefined' || window.document == undefined) {
    self.onmessage = function (e) {
        var arrBuffer = e.data;
        var buffer = new Buffer(new Int8Array(arrBuffer));
        var ManifestParser = require('adbkit-apkreader/lib/apkreader/parser/manifest.js');
        var parser = new ManifestParser(buffer);
        var result = parser.parse();
        self.postMessage(result);
    };
}

