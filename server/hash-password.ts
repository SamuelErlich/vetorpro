import bcrypt from 'bcrypt';

const password = process.argv[2];
if (!password) {
  console.error('Usage: tsx hash-password.ts <password>');
  process.exit(1);
}

const saltRounds = 10;
const hash = bcrypt.hashSync(password, saltRounds);
console.log('Password:', password);
console.log('Hash:', hash);

// Test the hash
const matches = bcrypt.compareSync(password, hash);
console.log('Verification:', matches ? 'Success' : 'Failed');