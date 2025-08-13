// @ts-check
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
	testDir: 'e2e',
	timeout: 60000,
	retries: process.env.CI ? 2 : 0,
	reporter: 'list',
	use: {
		baseURL: process.env.BASE_URL || 'http://127.0.0.1:4173',
		headless: true,
		video: 'retain-on-failure',
		screenshot: 'only-on-failure'
	},
	projects: [
		{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }
	]
});


