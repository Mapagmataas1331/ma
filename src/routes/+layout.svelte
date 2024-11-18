<script lang="ts">
	import Header from '$shared/components/Header.svelte';
	import { Toaster } from '$shared/components/ui/sonner/index.js';
	import '@/app.scss';

	let { children } = $props();
</script>

<Header
	navLinks={{
		'/': { name: 'Home', nameRu: 'Главная' },
		'https://more.ma.cyou': { name: 'More', nameRu: 'Больше' }
	}}
/>

<Toaster />

{@render children?.()}
