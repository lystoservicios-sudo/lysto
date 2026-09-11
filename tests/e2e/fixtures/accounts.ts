// Use the same real Auth accounts and scoped cleanup in browser tests. Never
// persist passwords/JWTs in repository fixtures or committed storageState files.
export { createFixtureAccounts, accountNames } from '../../integration/fixtures'
export type { AccountName, FixtureAccount } from '../../integration/fixtures'
