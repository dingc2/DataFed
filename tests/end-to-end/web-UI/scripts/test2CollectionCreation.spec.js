import { test, expect } from '@playwright/test';

// 1. Login to DataFed
// 2. Click on a Collection in user/project space
// 3. Create new collection
// 4. Enter a title
// 5. Press Create
test('create a collection', async ({page}) => {
  await page.goto('/'); // baseURL is in playwright.config
  await page.getByText('Root Collection').click();
  await page.getByText('Root Collectionc/').click({
    button: 'right'
  });
  await page.getByRole('menuitem', { name: ' New' }).click();
  await page.getByRole('menuitem', { name: 'Collection' }).click();
  await page.locator('#title').fill('TestCollection');
  await page.getByRole('button', { name: 'Create' }).click();
  await page.getByText('TestCollectionc/').click({ button: "right" });
  await page.getByRole('menuitem', { name: ' Actions' }).click();
  await page.getByRole('menuitem', { name: 'Delete' }).click();
  await page.getByLabel('Confirm Deletion').getByRole('button', { name: 'Delete' }).click();

});