
import { test, expect } from '@playwright/test';

test('has title', async ({ page }) => {
    await page.goto('/');

    // Expect a title "to contain" a substring.
    await expect(page).toHaveTitle(/TecHub/);
});

test('loads login page or dashboard', async ({ page }) => {
    await page.goto('/');

    // Wait for network idle to ensure redirection happens
    await page.waitForLoadState('networkidle');

    // Check if we are on login page or dashboard
    const url = page.url();
    if (url.includes('/login') || url.includes('/auth')) {
        await expect(page.getByText(/Entrar|Login|Bem-vindo/i)).toBeVisible();
    } else {
        // Assuming dashboard - check for StatsGrid components
        await expect(page.locator('text=Total de Leads')).toBeVisible();
        await expect(page.locator('text=Disparos')).toBeVisible();
    }
});
