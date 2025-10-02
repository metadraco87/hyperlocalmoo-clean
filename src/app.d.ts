// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			auth: {
				token: string;
				email: string;
				username: string;
			} | null;
			nonce: string;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}

	// Add Google AdSense global type definition
	interface Window {
		adsbygoogle: {
			push: (params: {}) => void;
		}[];
	}
}

export {};
