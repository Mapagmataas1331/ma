<script lang="ts">
	import { onMount } from 'svelte';

	import Header from '$shared/components/Header.svelte';

	import '@/app.scss';

	onMount(() => {
		console.log('Layout mounted');
	});
</script>

<Header />
<slot />
