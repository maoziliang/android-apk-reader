var Buffer = require('buffer').Buffer;
var SeekOrigin = {
    'Begin': 0
};
var Debug = {
    'WriteLine': function (msg) {
        //console.log(msg);
    }
};
var ToX4String = function (num) {
    return ('00000000' + num.toString(16)).substr(-8).toUpperCase();
};
Object.prototype.ToString = function (style) {
    if ( style == "X4" ) {
        //return this.toString();
        return ToX4String(this);
    }
    return this.toString();
}
Object.prototype.ContainsKey = function (key) {
    return this[key] !== undefined;
};
Object.prototype.Add = function (key, value) {
    this[key] = value;
};
String.prototype.ToUpper = function () {
    return this.toUpperCase();
};
var System = {
    'Globalization': {
        'NumberStyles': {
            'HexNumber': 16
        }
    }
};
var int = {
    'Parse': function (str, style) {
        if ( style == System.Globalization.NumberStyles.HexNumber ) {
            return parseInt('0x' + str);
        }
        return parseInt(str);
    }
};
var Encoding = {
    'UTF8': {
        'GetString': function (buffer) {
            return buffer.toString('utf-8');
        }
    }
};
Array.prototype.Add = function (item) {
    return this.push(item);
};
var BufferReader = function (buffer) {
    this._buffer = buffer;
    this.BaseStream = {};
    this.BaseStream.Length = buffer.length;
    this.BaseStream.Position = 0;
    this.BaseStream.Seek = function (offset, start) {
        this.Position = start + offset;
    };
};
BufferReader.prototype.ReadInt16 = function () {
    var temp = this._buffer.readInt16LE(this.BaseStream.Position, true);
    this.BaseStream.Position += 2;
    return temp;
};
BufferReader.prototype.ReadInt32 = function () {
    var temp = this._buffer.readInt32LE(this.BaseStream.Position, true);
    this.BaseStream.Position += 4;
    return temp;
};
BufferReader.prototype.ReadBytes = function (length) {
    var temp = this._buffer.slice(this.BaseStream.Position, this.BaseStream.Position + length);
    this.BaseStream.Position += length;
    return temp;
};
BufferReader.prototype.ReadChar = function () {
    var charCode = this.ReadByte(true);
    if (charCode) {
        var ch = String.fromCharCode(charCode);
        return ch;
    } else {
        return 0;
    }
};
BufferReader.prototype.ReadByte = function () {
    var temp = this._buffer.readInt8(this.BaseStream.Position, true);
    this.BaseStream.Position += 1;
    return temp;
};
var HEADER_START = 0;
var RES_STRING_POOL_TYPE = 0x0001;
var RES_TABLE_TYPE = 0x0002;
var RES_TABLE_PACKAGE_TYPE = 0x0200;
var RES_TABLE_TYPE_TYPE = 0x0201;
var RES_TABLE_TYPE_SPEC_TYPE = 0x0202;

var valueStringPool = null;
var typeStringPool = null;
var keyStringPool = null;

var package_id = 0;

var TYPE_REFERENCE = 0x01;
// The 'data' holds an index into the containing resource table's
// global value string pool.
var TYPE_STRING = 0x03;

var responseMap = {};

var entryMap = {};

var ApkResourceFinder = {
    getResourceTable: function(buffer) {
        //byte[] data = System.IO.File.ReadAllBytes("resources.arsc");
        responseMap = {};
        entryMap = {};
        this.resIdList = [];
        package_id = 0;
        valueStringPool = null;
        typeStringPool = null;
        keyStringPool = null;

        return this.processResourceTable(buffer);
    },
    processResourceTable: function(buffer) {

        var lastPosition = 0;
        var br = new BufferReader(buffer);

        var type = br.ReadInt16();
        var headerSize = br.ReadInt16();
        var size = br.ReadInt32();
        var packageCount = br.ReadInt32();


        if (type !== RES_TABLE_TYPE)
        {
            throw new Error("No RES_TABLE_TYPE found!");
        }
        if (size !== br.BaseStream.Length)
        {
            throw new Error(
                            "The buffer size not matches to the resource table size.");
        }

        var realStringPoolCount = 0;
        var realPackageCount = 0;


        while (true)
        {
            var pos = br.BaseStream.Position;
            var t = br.ReadInt16();
            var hs = br.ReadInt16();
            var s = br.ReadInt32();

            if (t == RES_STRING_POOL_TYPE)
            {
                if (realStringPoolCount == 0)
                {
                    // Only the first string pool is processed.
                    //Debug.WriteLine("Processing the string pool ...");
                    Debug.WriteLine("Processing the string pool ...");


                    //byte[] buffer = new byte[s];
                    lastPosition = br.BaseStream.Position;
                    br.BaseStream.Seek(pos, SeekOrigin.Begin);
                    var buffer = br.ReadBytes(s);
                    //br.BaseStream.Seek(lastPosition, SeekOrigin.Begin);

                    valueStringPool = this.processStringPool(buffer);

                }
                realStringPoolCount++;

            }
            else if (t == RES_TABLE_PACKAGE_TYPE)
            {
                // Process the package
                //Debug.WriteLine("Processing package {0} ...", realPackageCount);
                Debug.WriteLine("Processing package " + realPackageCount + " ...");

                //byte[] buffer = new byte[s];
                lastPosition = br.BaseStream.Position;
                br.BaseStream.Seek(pos, SeekOrigin.Begin);
                var buffer = br.ReadBytes(s);
                //br.BaseStream.Seek(lastPosition, SeekOrigin.Begin);
                this.processPackage(buffer);

                realPackageCount++;

            }
            else
            {
                throw new Error("Unsupported Type");
            }
            br.BaseStream.Seek(pos + s, SeekOrigin.Begin);
            if (br.BaseStream.Position == br.BaseStream.Length)
                break;

        }

        if (realStringPoolCount !== 1)
        {
            throw new Error("More than 1 string pool found!");
        }
        if (realPackageCount !== packageCount)
        {
            throw new Error(
                            "Real package count not equals the declared count.");
        }

        return responseMap;


    },

    processPackage: function (buffer) {
        var lastPosition = 0;

        var br = new BufferReader(buffer);
        //HEADER
        var type = br.ReadInt16();
        var headerSize = br.ReadInt16();
        var size = br.ReadInt32();

        var id = br.ReadInt32();
        package_id = id;

        //PackageName
        var name = [];
        for (var i = 0; i < 256; ++i)
        {
            name[i] = br.ReadChar();
        }
        var typeStrings = br.ReadInt32();
        var lastPublicType = br.ReadInt32();
        var keyStrings = br.ReadInt32();
        var lastPublicKey = br.ReadInt32();

        if (typeStrings !== headerSize)
        {
            throw new Error("TypeStrings must immediately follow the package structure header.");
        }

        //Debug.WriteLine("Type strings:");
        lastPosition = br.BaseStream.Position;
        br.BaseStream.Seek(typeStrings, SeekOrigin.Begin);
        var bbTypeStrings = br.ReadBytes(br.BaseStream.Length - br.BaseStream.Position);
        br.BaseStream.Seek(lastPosition, SeekOrigin.Begin);

        typeStringPool = this.processStringPool(bbTypeStrings);

        Debug.WriteLine("Key strings:");

        br.BaseStream.Seek(keyStrings, SeekOrigin.Begin);
        var key_type = br.ReadInt16();
        var key_headerSize = br.ReadInt16();
        var key_size = br.ReadInt32();

        lastPosition = br.BaseStream.Position;
        br.BaseStream.Seek(keyStrings, SeekOrigin.Begin);
        var bbKeyStrings = br.ReadBytes(br.BaseStream.Length - br.BaseStream.Position);
        br.BaseStream.Seek(lastPosition, SeekOrigin.Begin);

        keyStringPool = this.processStringPool(bbKeyStrings);



        // Iterate through all chunks
        //
        var typeSpecCount = 0;
        var typeCount = 0;

        br.BaseStream.Seek((keyStrings + key_size), SeekOrigin.Begin);

        while (true)
        {
            var pos = br.BaseStream.Position;
            var t = br.ReadInt16();
            var hs = br.ReadInt16();
            var s = br.ReadInt32();

            if (t == RES_TABLE_TYPE_SPEC_TYPE)
            {
                // Process the string pool
                br.BaseStream.Seek(pos, SeekOrigin.Begin);
                var buffer = br.ReadBytes(s);

                this.processTypeSpec(buffer);

                typeSpecCount++;
            }
            else if (t == RES_TABLE_TYPE_TYPE)
            {
                // Process the package
                br.BaseStream.Seek(pos, SeekOrigin.Begin);
                var buffer = br.ReadBytes(s);

                this.processType(buffer);

                typeCount++;
            }

            br.BaseStream.Seek(pos + s, SeekOrigin.Begin);
            if (br.BaseStream.Position == br.BaseStream.Length)
                break;
        }

        return;


    },

    putIntoMap: function (resId, value) {
        var valueList = null;
        if (responseMap.ContainsKey(resId.ToUpper()))
            valueList = responseMap[resId.ToUpper()];
        if (valueList == null)
        {
            valueList = [];
        }
        valueList.Add(value);
        if (responseMap.ContainsKey(resId.ToUpper()))
            responseMap[resId.ToUpper()] = valueList;
        else
            responseMap.Add(resId.ToUpper(), valueList);
        return;

    },

    processType: function (typeData) {
        var br = new BufferReader(typeData);
        var type = br.ReadInt16();
        var headerSize = br.ReadInt16();
        var size = br.ReadInt32();
        var id = br.ReadByte();
        var res0 = br.ReadByte();
        var res1 = br.ReadInt16();
        var entryCount = br.ReadInt32();
        var entriesStart = br.ReadInt32();

        //Dictionary<String, int> refKeys = new Dictionary<String, int>();
        var refKeys = {};

        var config_size = br.ReadInt32();

        // Skip the config data
        br.BaseStream.Seek(headerSize, SeekOrigin.Begin);


        if (headerSize + entryCount * 4 !== entriesStart)
        {
            throw new Error("HeaderSize, entryCount and entriesStart are not valid.");
        }

        // Start to get entry indices
        var entryIndices = [];
        for (var i = 0; i < entryCount; ++i)
        {
            entryIndices[i] = br.ReadInt32();
        }

        // Get entries
        for (var i = 0; i < entryCount; ++i)
        {
            if (entryIndices[i] == -1)
                continue;

            var resource_id = (package_id << 24) | (id << 16) | i;

            var pos = br.BaseStream.Position;
            var entry_size = br.ReadInt16();
            var entry_flag = br.ReadInt16();
            var entry_key = br.ReadInt32();

            // Get the value (simple) or map (complex)
            var FLAG_COMPLEX = 0x0001;

            if ((entry_flag & FLAG_COMPLEX) == 0)
            {
                // Simple case
                var value_size = br.ReadInt16();
                var value_res0 = br.ReadByte();
                var value_dataType = br.ReadByte();
                var value_data = br.ReadInt32();

                //String idStr = resource_id.ToString("X4");
                var idStr = resource_id.ToString("X4");
                var keyStr = keyStringPool[entry_key];
                var data = null;

                Debug.WriteLine("Entry 0x" + idStr + ", key: " + keyStr + ", simple value type: ");

                var entryArr = null;
                if (entryMap.ContainsKey(int.Parse(idStr, System.Globalization.NumberStyles.HexNumber)))
                    entryArr = entryMap[int.Parse(idStr, System.Globalization.NumberStyles.HexNumber)];

                if (entryArr == null)
                    entryArr = [];

                entryArr.Add(keyStr);
                if (entryMap.ContainsKey(int.Parse(idStr, System.Globalization.NumberStyles.HexNumber)))
                    entryMap[int.Parse(idStr, System.Globalization.NumberStyles.HexNumber)] = entryArr;
                else
                    entryMap.Add(int.Parse(idStr, System.Globalization.NumberStyles.HexNumber), entryArr);

                if (value_dataType == TYPE_STRING)
                {
                    data = valueStringPool[value_data];
                    Debug.WriteLine(", data: " + valueStringPool[value_data] + "");
                }
                else if (value_dataType == TYPE_REFERENCE)
                {
                    var hexIndex = value_data.ToString("X4");
                    refKeys.Add(idStr, value_data);
                }
                else
                {
                    data = value_data.ToString();
                    Debug.WriteLine(", data: " + value_data + "");
                }

                this.putIntoMap("@" + idStr, data);
            } else {
                var entry_parent = br.ReadInt32();
                var entry_count = br.ReadInt32();

                for (var j = 0; j < entry_count; ++j)
                {
                    var ref_name = br.ReadInt32();
                    var value_size = br.ReadInt16();
                    var value_res0 = br.ReadByte();
                    var value_dataType = br.ReadByte();
                    var value_data = br.ReadInt32();
                }

                Debug.WriteLine("Entry 0x"
                        + resource_id.ToString("X4") + ", key: "
                        + keyStringPool[entry_key]
                        + ", complex value, not printed.");
            }

        }
        //HashSet<String> refKs = new HashSet<String>(refKeys.Keys);
        var refKs = refKeys;// Object.keys(refKeys);

        for(var refK in refKs) {
            var values = null;
            if (responseMap.ContainsKey("@" + refKeys[refK].ToString("X4").ToUpper()))
                values = responseMap["@" + refKeys[refK].ToString("X4").ToUpper()];

            if (values !== null)
                for (var value in values) {
                    this.putIntoMap("@" + refK, value);
                }
        }
        return;

    },

    processStringPool: function (data) {
        var lastPosition = 0;


        var br = new BufferReader(data);
        var type = br.ReadInt16();
        var headerSize = br.ReadInt16();
        var size = br.ReadInt32();
        var stringCount = br.ReadInt32();
        var styleCount = br.ReadInt32();
        var flags = br.ReadInt32();
        var stringsStart = br.ReadInt32();
        var stylesStart = br.ReadInt32();

        var isUTF_8 = (flags & 256) !== 0;

        var offsets = [];
        for (var i = 0; i < stringCount; ++i)
        {
            offsets[i] = br.ReadInt32();
        }
        var strings = [];

        for (var i = 0; i < stringCount; i++)
        {
            var pos = stringsStart + offsets[i];
            lastPosition = br.BaseStream.Position;
            var len = br.BaseStream.Seek(pos, SeekOrigin.Begin);
            br.BaseStream.Seek(lastPosition, SeekOrigin.Begin);

            if (len < 0)
            {
                var extendShort = br.ReadInt16();
            }
            pos += 2;
            strings[i] = "";
            if (isUTF_8)
            {
                var start = pos;
                var length = 0;
                lastPosition = br.BaseStream.Position;
                br.BaseStream.Seek(pos, SeekOrigin.Begin);
                while (br.ReadByte() !== 0)
                {
                    length++;
                    pos++;
                }
                br.BaseStream.Seek(lastPosition, SeekOrigin.Begin);

                var oneData = new Buffer(length);
                if (length > 0)
                {
                    var byteArray = data;
                    for (var k = 0; k < length; k++)
                    {
                        oneData[k] = byteArray[start + k];
                    }
                }
                if (oneData.length > 0)
                    strings[i] = Encoding.UTF8.GetString(oneData);
                else
                    strings[i] = "";
            }
            else
            {
                var c;
                lastPosition = br.BaseStream.Position;
                br.BaseStream.Seek(pos, SeekOrigin.Begin);
                while ((c = br.ReadChar()) !== 0)
                {
                    strings[i] += c;
                    br.ReadChar();
                    pos += 2;
                }
                br.BaseStream.Seek(lastPosition, SeekOrigin.Begin);
            }
            Debug.WriteLine("Parsed value: " + strings[i]);


        }
        return strings;

    },

    processTypeSpec: function (data) {
        var br = new BufferReader(data);
        var type = br.ReadInt16();
        var headerSize = br.ReadInt16();
        var size = br.ReadInt32();
        var id = br.ReadByte();
        var res0 = br.ReadByte();
        var res1 = br.ReadInt16();
        var entryCount = br.ReadInt32();


        Debug.WriteLine("Processing type spec " + typeStringPool[id - 1]);

        var flags = [];
        for (var i = 0; i < entryCount; ++i);
        {
            flags[i] = br.ReadInt32();
        }

        return;
    }

};

if (typeof window == 'undefined' || window.document == undefined) {
    self.onmessage = function (e) {
        var arrBuffer = e.data;
        var buffer = new Buffer(new Uint8Array(arrBuffer));

        var fileMap = ApkResourceFinder.getResourceTable(buffer);
        self.postMessage(fileMap);
    };
}

