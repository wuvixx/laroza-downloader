const fs = require("fs/promises");

const JuicyCodes = {
    Juice: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=", Decode: function(e) {
        var t = "", n, r, i, s, o, u, a, f = 0;
        for (e = e.replace(new RegExp("[^A-Za-z0-9+\\/=]", "g"), ""); f < e.length;) s = this.Juice.indexOf(e.charAt(f++)), o = this.Juice.indexOf(e.charAt(f++)), u = this.Juice.indexOf(e.charAt(f++)), a = this.Juice.indexOf(e.charAt(f++)), n = s << 2 | o >> 4, r = (15 & o) << 4 | u >> 2, i = (3 & u) << 6 | a, t += String.fromCharCode(n), 64 != u && (t += String.fromCharCode(r)), 64 != a && (t += String.fromCharCode(i));
        t = JuicyCodes.utf8(t);
        return t;
        // try { eval(t) } catch (_) { }
    }, utf8: function(a) {
        for (var b = "", c = 0, d = c1 = c2 = 0; c < a.length;) d = a.charCodeAt(c), d < 128 ? (b += String.fromCharCode(d), c++) : d > 191 && d < 224 ? (c2 = a.charCodeAt(c + 1), b += String.fromCharCode((31 & d) << 6 | 63 & c2), c += 2) : (c2 = a.charCodeAt(c + 1), c3 = a.charCodeAt(c + 2), b += String.fromCharCode((15 & d) << 12 | (63 & c2) << 6 | 63 & c3), c += 3);
        return b;
    }
};

function decodeFunc2(_A, _O, _K) {
    var _S = _A.join("");
    _O %= _S.length;
    var _U = _S.slice(_S.length - _O) + _S.slice(0, _S.length - _O);
    var _C = _U.replace(/[^A-Za-z0-9+\/=]/g, "");
    var _B = atob(_C), _KB = atob(_K);
    var _arr = new Uint8Array(_B.length);
    for (var _i = 0; _i < _B.length; _i++) {
        _arr[_i] = (_B.charCodeAt(_i) ^ _KB.charCodeAt(_i % _KB.length)) & 255;
    }
    var _R;
    try {
        _R = new TextDecoder("utf-8").decode(_arr);
        return _R;
    } catch (e) {
        var _tmp = "";
        for (var _j = 0; _j < _arr.length; _j++) {
            _tmp += String.fromCharCode(_arr[_j]);
        }
        _R = decodeURIComponent(escape(_tmp));
    }
}

function unpack(str) {
    // Extract the parts
    const parts = str.split("('").slice(2).join("('").match(/(.*)',(\d+),\d+,'(.*)'\.split\('\|'/);
    if (!parts) {
        throw new Error("Couldn't extract parts");
    }

    // Extract the base
    const base = parts[2];

    // Extract the code
    let packedCode = parts[1];
    packedCode = packedCode.replaceAll("\\'", "'");

    // Extract the dictionary
    const dictionary = parts[3].split("|");

    const toBase10 = word => {
        return word.split("").reduce((acc, char) => {
            const idx = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ".indexOf(char);
            return acc * base + idx;
        }, 0);
    }

    return packedCode.replace(/\b\w+\b/g, word => {
        const index = toBase10(word);
        return dictionary[index] || word;
    });
}

async function main() {
    const content = await fs.readFile("packed.txt", "utf-8");
    // console.log(content.replaceAll("\\'", "'"));
    // return;
    try {
        const newStr = unpack(content);
        console.log(newStr);
    } catch (ex) {
        console.error(ex);
    }
}

if (require.main === module) {
    main();
}

module.exports = { unpack, JuicyCodes, decodeFunc2 };
