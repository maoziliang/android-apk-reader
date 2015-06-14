var apkReader = {}

if (typeof exports !== 'undefined') {
    apkReader = exports;
}

(function (apkReader) {
    var getFileMap = function (blob) {
        var deferred = $.Deferred();
        zip.createReader(new zip.BlobReader(blob), function (reader) {
            var fileMap = {};
            reader.getEntries(function (entries) {
                entries.forEach(function (entry) {
                    fileMap[entry.filename] = entry;
                });
                deferred.resolve(reader, fileMap);
            });
        }, function (error) {
            deferred.reject(error)
        });
        return deferred.promise();
    };

    var getManifest = function (fileEntry) {
        var deferred = $.Deferred();
        fileEntry.getData(new zip.BlobWriter(), function (blob) {
            var reader = new FileReader();
            var worker = new Worker('/statics/cleanzone/script/content/apk/apk2xml.bundle.js');
            worker.onmessage = function (e) {
                var xml = e.data;
                deferred.resolve(xml);
                worker.terminate();
            };
            reader.onload = function () {
                worker.postMessage(reader.result);
            };
            reader.onerror = function (e) {
                deferred.reject(e);
            };
            reader.readAsArrayBuffer(blob);
        });
        return deferred.promise();
    };

    var getResourceTable = function (fileEntry) {
        var deferred = $.Deferred();
        fileEntry.getData(new zip.BlobWriter(), function(blob) {
            var reader = new FileReader();
            var worker = new Worker('/statics/cleanzone/script/content/apk/resource.bundle.js');
            worker.onmessage = function (e) {
                var fileMap = e.data;
                deferred.resolve(fileMap);
            };
            reader.onload = function () {
                worker.postMessage(reader.result);
            };
            reader.onerror = function (e) {
                deferred.reject(e);
            };
            reader.readAsArrayBuffer(blob);
        });
        return deferred;
    };

    var getIconBlob = function (info, fileMap) {
        var deferred = $.Deferred();
        var iconEntry = fileMap[info.icon];
        var finish = 0;
        iconEntry.getData(new zip.BlobWriter(), function (blob) {
            info.iconBlob = blob;
            finish += 1;
            if (finish == 2) {
                deferred.resolve(info);
            }
        });
        iconEntry.getData(new zip.Data64URIWriter(), function (base64Uri) {
            info.iconBase64Uri = base64Uri;
            finish += 1;
            if (finish == 2) {
                deferred.resolve(info);
            }
        });
        return deferred.promise();
    };
    var extractInfo = function (manifest, resMap) {
        var info = {},
            labelResId = null;
        if (manifest.application['label']) {
            labelResId = manifest.application['label'].replace('resourceId:0x', '');
        }
        var iconResId = manifest.application['icon'].replace('resourceId:0x', '');
        labelResId = labelResId.toUpperCase();
        iconResId = iconResId.toUpperCase();
        info.versionCode = manifest['versionCode'];
        info.versionName = manifest['versionName'];
        info.package = manifest['package'];
        if (labelResId && resMap['@' + labelResId]) {
            info.label = resMap['@' + labelResId][0];
        }

        var icons = resMap['@' + iconResId];
        info.icon = icons.filter(function (icon) {
            return icon.indexOf('drawable-mdpi') != -1;
        })[0] || icons[0];

        return info;
    };

    apkReader.getApkInfo = function (blob) {
        var deferred = $.Deferred();
        getFileMap(blob).done(function (reader, fileMap) {
            var manifestEntry = fileMap['AndroidManifest.xml'];
            var resEntry = fileMap['resources.arsc'];
            $.when(getManifest(manifestEntry), getResourceTable(resEntry))
                .then(function done(manifest, resMap) {
                    var info = extractInfo(manifest, resMap);
                    return getIconBlob(info, fileMap);
                }, function fail(err) {
                    deferred.reject(err);
                    reader.close();
                })
                .done(function (info) {
                    deferred.resolve(info);
                })
                .fail(function (err) {
                    deferred.reject(err);
                })
                .always(function () {
                    reader.close();
                });
        });
        return deferred.promise();
    };
})(apkReader);
