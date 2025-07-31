const CryptoJS = require('crypto-js');

function xorEncrypt(text, password) {
  if (!password) throw new Error('Password is required for XOR encryption');
  let out = '';
  for (let i = 0; i < text.length; i++) {
    out += String.fromCharCode(text.charCodeAt(i) ^ password.charCodeAt(i % password.length));
  }
  return Buffer.from(out, 'utf8').toString('base64');
}

function xorDecrypt(data, password) {
  if (!password) throw new Error('Password is required for XOR decryption');
  const text = Buffer.from(data, 'base64').toString('utf8');
  let out = '';
  for (let i = 0; i < text.length; i++) {
    out += String.fromCharCode(text.charCodeAt(i) ^ password.charCodeAt(i % password.length));
  }
  return out;
}

module.exports = {
  encrypt(text, password, type = 'AES') {
    if ((['AES','DES','TripleDES','Rabbit','XOR'].includes(type)) && !password) {
      // If no password, switch to None mode
      return text;
    }
    if (type === 'AES') {
      return CryptoJS.AES.encrypt(text, password).toString();
    } else if (type === 'DES') {
      return CryptoJS.DES.encrypt(text, password).toString();
    } else if (type === 'TripleDES') {
      return CryptoJS.TripleDES.encrypt(text, password).toString();
    } else if (type === 'Rabbit') {
      return CryptoJS.Rabbit.encrypt(text, password).toString();
    } else if (type === 'XOR') {
      return xorEncrypt(text, password);
    } else if (type === 'None') {
      return text;
    } else {
      throw new Error('Unsupported encryption type: ' + type);
    }
  },
  decrypt(data, password, type = 'AES') {
    if ((['AES','DES','TripleDES','Rabbit','XOR'].includes(type)) && !password) {
      // If no password, switch to None mode
      return data;
    }
    if (type === 'AES') {
      return CryptoJS.AES.decrypt(data, password).toString(CryptoJS.enc.Utf8);
    } else if (type === 'DES') {
      return CryptoJS.DES.decrypt(data, password).toString(CryptoJS.enc.Utf8);
    } else if (type === 'TripleDES') {
      return CryptoJS.TripleDES.decrypt(data, password).toString(CryptoJS.enc.Utf8);
    } else if (type === 'Rabbit') {
      return CryptoJS.Rabbit.decrypt(data, password).toString(CryptoJS.enc.Utf8);
    } else if (type === 'XOR') {
      return xorDecrypt(data, password);
    } else if (type === 'None') {
      return data;
    } else {
      throw new Error('Unsupported encryption type: ' + type);
    }
  }
};
