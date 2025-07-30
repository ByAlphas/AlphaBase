const enc = require('../encryption');

test('AES encryption/decryption', () => {
  const text = 'hello world';
  const password = 'secret';
  const encrypted = enc.encrypt(text, password, 'AES');
  const decrypted = enc.decrypt(encrypted, password, 'AES');
  expect(decrypted).toBe(text);
});

test('XOR encryption/decryption', () => {
  const text = 'hello world';
  const password = 'secret';
  const encrypted = enc.encrypt(text, password, 'XOR');
  const decrypted = enc.decrypt(encrypted, password, 'XOR');
  expect(decrypted).toBe(text);
});

test('None encryption', () => {
  const text = 'hello world';
  const encrypted = enc.encrypt(text, '', 'None');
  const decrypted = enc.decrypt(encrypted, '', 'None');
  expect(decrypted).toBe(text);
});
