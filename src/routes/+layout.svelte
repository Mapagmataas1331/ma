<script lang="ts">
	import Header from '$shared/components/Header.svelte';
	import { Toaster } from '$shared/components/ui/sonner/index.js';
	import '@/app.scss';

	let { children } = $props();
</script>

<Header
	links={{
		'/': { name: 'Home', nameRu: 'Главная' },
		'https://more.ma.cyou': { name: 'more', nameRu: 'больше' }
	}}
/>

<Toaster />

{@render children?.()}
