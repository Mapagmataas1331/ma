<script lang="ts">
	import Github from 'lucide-svelte/icons/github';
	import Send from 'lucide-svelte/icons/send';

	import HoverCard from '$shared/components/HoverCard.svelte';
	import Button from '$shared/components/ui/button/button.svelte';
	import * as Tooltip from '$shared/components/ui/tooltip';

	import './page.scss';

	import { language } from '$shared/stores/language';
	import { theme } from '$shared/stores/theme';

	const easterEgg = (target: HTMLElement) => {
		target.innerHTML = '👀';
		setTimeout(() => (target.style.transform = 'scaleX(-1)'), 500);
		setTimeout(() => (target.style.transform = ''), 1000);
		setTimeout(() => (target.innerHTML = '👋'), 1500);
	};
</script>

<div
	class="w-full snap-y snap-mandatory justify-center overflow-y-scroll scroll-smooth bg-gradient-to-br from-white to-sky-200 dark:from-sky-800 dark:to-black"
>
	<section class="relative flex snap-start items-center justify-center">
		<div class="text-center">
			<h1
				class="block items-center justify-center text-3xl font-bold sm:flex sm:text-4xl md:text-5xl"
			>
				{#if $language === 'ru'}
					<div class="flex items-center justify-center">
						Привет&nbsp;
						<button
							class="cursor-grab grayscale-[20%] hover:scale-110"
							on:click={(e) => easterEgg(e.target as HTMLElement)}
						>
							👋
						</button>
						,
					</div>
					<div class="ml-0 text-2xl sm:ml-2 sm:text-4xl md:text-5xl">я автор</div>
				{:else}
					<div class="flex items-center justify-center">
						Hi&nbsp;
						<button
							class="cursor-grab grayscale-[20%] hover:scale-110"
							on:click={(e) => easterEgg(e.target as HTMLElement)}
						>
							👋
						</button>
						,
					</div>
					<div class="ml-0 text-2xl sm:ml-2 sm:text-4xl md:text-5xl">I am the author</div>
				{/if}
			</h1>
			<p class="mt-2 text-base sm:mt-5 md:text-lg">
				{$language === 'ru' ? 'Веб-разработчик и дизайнер' : 'Web developer and designer'}
			</p>
			<img
				src="/author.png"
				alt={$language === 'ru' ? 'Фото Aвтора' : "Author's photo"}
				class="mx-auto mt-5 flex h-full max-h-[calc((100dvh_-_3.5rem)_/_2)] min-h-48 items-center justify-center rounded-3xl shadow-xl transition-transform hover:scale-105 sm:mt-10 md:max-h-[calc((100dvh_-_4rem)_/_2)] {$theme ===
				'dark'
					? 'pattern-light'
					: 'pattern'}"
			/>
			<div class="mt-5 flex flex-col items-center justify-center sm:mt-10 md:flex-row">
				<Button
					href="#about"
					variant="default"
					class="m-2 min-w-48 font-semibold shadow-lg hover:scale-105"
				>
					{$language === 'ru' ? 'Больше обо мне' : 'More about me'}
				</Button>
				<Button
					href="#socials"
					variant="default"
					class="m-2 min-w-48 font-semibold shadow-lg hover:scale-105"
				>
					{$language === 'ru' ? 'Мои Соц. сети' : 'My Social links'}
				</Button>
			</div>
		</div>
	</section>
	<section
		id="about"
		class="relative z-10 flex snap-start flex-col items-center justify-center text-xs leading-normal tracking-tight md:text-base md:leading-relaxed md:tracking-normal"
	>
		<div class="container z-10 max-h-full">
			<h1 class="scroll-m-20 text-2xl font-extrabold tracking-tight md:text-4xl lg:text-5xl">
				{$language === 'ru' ? 'Обо мне' : 'About me'}
			</h1>
			<div class="mt-0 md:mt-6">
				{#if $language === 'ru'}
					<ul class="my-4 ml-3 list-disc space-y-2 md:my-8 md:ml-6 md:space-y-4 [&>li]:mt-2">
						<li>
							<p>
								Меня зовут Тимофей, мой ник — "Mapagmataas". В настоящий момент я работаю в <HoverCard
									class="font-semibold italic"
									link="https://www.inp.nsk.su/"
									name="ИЯФ"
									img="https://inp.nsk.su/images/logo/OfficiallogoBINPblueClear.gif"
									fallback="ИЯФ"
									title="ИЯФ СО РАН"
									description="Институт ядерной физики имени Г. И. Будкера СО РАН"
								/> лаборантом на
								<a href="https://ru.wikipedia.org/wiki/ВЭПП-2000" target="_blank"
									>коллайдере частиц</a
								>. Основное направление моей деятельности —
								<a href="https://wikipedia.org/wiki/Solution_stack#Full-stack_developer"
									>full stack</a
								> разработка веб-сайтов для управления данными, приборами и различными системами.
							</p>
						</li>
						<li>
							<p>
								Я увлекаюсь веб-дизайном и front-end разработкой, постоянно нахожу новые решения и
								стремлюсь узнавать что-то новое, и не побоюсь сказать, что уверен в своих знаниях <a
									href="https://wikipedia.org/wiki/HTML"
									target="_blank">HTML</a
								>, <a href="https://wikipedia.org/wiki/CSS" target="_blank">CSS</a>,
								<a href="https://wikipedia.org/wiki/JavaScript" target="_blank">JavaScript</a>/<a
									href="https://wikipedia.org/wiki/TypeScript"
									target="_blank">TypeScript</a
								>, в моем любимом фреймворке <HoverCard
									class="font-semibold italic"
									link="https://svelte.dev/"
									name="Svelte"
									img="https://github.com/sveltejs.png"
									fallback="SK"
									title="SVELTE"
									description="Кибернетически улучшенные веб-приложения."
								/>, а также <HoverCard
									class="font-semibold italic"
									link="https://react.dev/"
									name="React"
									img="https://github.com/reactjs.png"
									fallback="RC"
									title="React"
									description="Библиотека для создания пользовательских интерфейсов."
								/>. Меня также привлекает мир разработки игр, и я горю желанием попробовать себя в
								<a href="https://wikipedia.org/wiki/Video_game_development" target="_blank"
									>game dev</a
								>. Я хорошо знаком с основами языков C-семейства (<a
									href="https://wikipedia.org/wiki/C_(programming_language)"
									target="_blank">C</a
								>,
								<a href="https://wikipedia.org/wiki/C_Sharp_(programming_language)" target="_blank"
									>C#</a
								>, <a href="https://wikipedia.org/wiki/C++" target="_blank">C++</a>, <HoverCard
									class="font-semibold italic"
									link="https://www.rust-lang.org/"
									name="Rust"
									img="https://github.com/rust-lang.png"
									fallback="RT"
									title="Rust"
									description="Язык, расширяющий возможности каждого для создания надежного и эффективного программного обеспечения."
								/>),
								<a href="https://wikipedia.org/wiki/Memory_management" target="_blank"
									>управлением памятью</a
								>,
								<a
									href="https://wikipedia.org/wiki/Multithreading_(computer_architecture)"
									target="_blank">многопоточностью</a
								>,
								<a
									href="https://wikipedia.org/wiki/Asynchrony_(computer_programming)"
									target="_blank">асинхронным программированием</a
								>.
							</p>
						</li>
						<li>
							<p>
								Также владею основами работы с <a
									href="https://wikipedia.org/wiki/Database"
									target="_blank">базами данных</a
								>
								— таких как
								<a href="https://wikipedia.org/wiki/PostgreSQL" target="_blank">PostgreSQL</a>,
								<a href="https://wikipedia.org/wiki/MySQL" target="_blank">MySQL</a>,
								<a href="https://wikipedia.org/wiki/SQLite" target="_blank">SQLite</a>,
								<a href="https://wikipedia.org/wiki/SQLAlchemy" target="_blank">SQLAlchemy</a>,
								<a href="https://wikipedia.org/wiki/Redis" target="_blank">Redis</a>
								и <a href="https://wikipedia.org/wiki/MongoDB" target="_blank">MongoDB</a>. Для
								повседневных задач я использую <HoverCard
									class="font-semibold italic"
									link="https://www.python.org/"
									name="Python"
									img="https://github.com/python.png"
									fallback="PY"
									title="Python"
									description="язык программирования, который позволяет работать быстро и более эффективно интегрировать программы."
								/> или <HoverCard
									class="font-semibold italic"
									link="https://go.dev/"
									name="Golang"
									img="https://github.com/golang.png"
									fallback="GO"
									title="GO"
									description="Создавайте простые, безопасные и масштабируемые программы с помощью Go."
								/>, и хорошо знаком с множеством модулей и библиотек для этих языков.
							</p>
						</li>
					</ul>
					<blockquote class="mt-6 border-l-2 border-muted-foreground pl-6 italic md:mt-10">
						Главное, что я ищу в своей работе, — это интересные задачи и профессиональный рост.
						Однако при этом я не спешу и стремлюсь к качественному развитию.
					</blockquote>
				{:else}
					<ul class="my-4 ml-3 list-disc space-y-2 md:my-8 md:ml-6 md:space-y-4 [&>li]:mt-2">
						<li>
							<p>
								My name is Timofey, and my nickname is "Mapagmataas". Currently, I work as a lab
								technician at <HoverCard
									class="font-semibold italic"
									link="https://www.inp.nsk.su/"
									name="BINP"
									img="https://inp.nsk.su/images/logo/OfficiallogoBINPblueClear.gif"
									fallback="BINP"
									title="Budker Institute of Nuclear Physics"
									description="G. I. Budker Institute of Nuclear Physics SB RAS"
								/> at a
								<a href="https://wikipedia.org/wiki/Collider" target="_blank">particle collider</a>.
								My primary area of expertise is
								<a href="https://wikipedia.org/wiki/Solution_stack#Full-stack_developer"
									>full stack</a
								> development of websites for managing data, instruments, and various systems.
							</p>
						</li>
						<li>
							<p>
								I am passionate about web design and front-end development, always looking for new
								solutions and eager to learn new things. I am confident in my knowledge of <a
									href="https://wikipedia.org/wiki/HTML"
									target="_blank">HTML</a
								>,
								<a href="https://wikipedia.org/wiki/CSS" target="_blank">CSS</a>,
								<a href="https://wikipedia.org/wiki/JavaScript" target="_blank">JavaScript</a>/<a
									href="https://wikipedia.org/wiki/TypeScript"
									target="_blank">TypeScript</a
								>, my favorite framework <HoverCard
									class="font-semibold italic"
									link="https://svelte.dev/"
									name="Svelte"
									img="https://github.com/sveltejs.png"
									fallback="SK"
									title="SVELTE"
									description="Cybernetically enhanced web apps."
								/>, and also <HoverCard
									class="font-semibold italic"
									link="https://react.dev/"
									name="React"
									img="https://github.com/reactjs.png"
									fallback="RC"
									title="React"
									description="A JavaScript library for building user interfaces."
								/>. I am also drawn to the world of game development and am eager to explore
								opportunities in
								<a href="https://wikipedia.org/wiki/Video_game_development" target="_blank"
									>game dev</a
								>. I am familiar with the basics of C-family languages (<a
									href="https://wikipedia.org/wiki/C_(programming_language)"
									target="_blank">C</a
								>,
								<a href="https://wikipedia.org/wiki/C_Sharp_(programming_language)" target="_blank"
									>C#</a
								>,
								<a href="https://wikipedia.org/wiki/C++" target="_blank">C++</a>, <HoverCard
									class="font-semibold italic"
									link="https://www.rust-lang.org/"
									name="Rust"
									img="https://github.com/rust-lang.png"
									fallback="RT"
									title="Rust"
									description="A language empowering everyone to build reliable and efficient software."
								/>),
								<a href="https://wikipedia.org/wiki/Memory_management" target="_blank"
									>memory management</a
								>,
								<a
									href="https://wikipedia.org/wiki/Multithreading_(computer_architecture)"
									target="_blank">multithreading</a
								>, and
								<a
									href="https://wikipedia.org/wiki/Asynchrony_(computer_programming)"
									target="_blank">asynchronous programming</a
								>.
							</p>
						</li>
						<li>
							<p>
								I also have a strong foundation in working with <a
									href="https://wikipedia.org/wiki/Database"
									target="_blank">databases</a
								>
								such as
								<a href="https://wikipedia.org/wiki/PostgreSQL" target="_blank">PostgreSQL</a>,
								<a href="https://wikipedia.org/wiki/MySQL" target="_blank">MySQL</a>,
								<a href="https://wikipedia.org/wiki/SQLite" target="_blank">SQLite</a>,
								<a href="https://wikipedia.org/wiki/SQLAlchemy" target="_blank">SQLAlchemy</a>,
								<a href="https://wikipedia.org/wiki/Redis" target="_blank">Redis</a>, and
								<a href="https://wikipedia.org/wiki/MongoDB" target="_blank">MongoDB</a>. For
								everyday tasks, I use <HoverCard
									class="font-semibold italic"
									link="https://www.python.org/"
									name="Python"
									img="https://github.com/python.png"
									fallback="PY"
									title="Python"
									description="A programming language that lets you work quickly and integrate systems more effectively."
								/> or <HoverCard
									class="font-semibold italic"
									link="https://go.dev/"
									name="Golang"
									img="https://github.com/golang.png"
									fallback="GO"
									title="Go"
									description="Create fast, reliable, and scalable programs with Go."
								/>, and I am well-versed in many modules and libraries for these languages.
							</p>
						</li>
					</ul>
					<blockquote class="mt-6 border-l-2 border-muted-foreground pl-6 italic md:mt-10">
						The most important thing I seek in my work is interesting challenges and professional
						growth. However, I am not in a hurry; I strive for quality development.
					</blockquote>
				{/if}
			</div>
		</div>
	</section>
	<section id="socials" class="relative flex snap-start flex-col items-center justify-center">
		<div class="container mx-auto text-center">
			<h2 class="text-4xl font-bold">{$language === 'ru' ? 'Мои Соц. сети' : 'My Social links'}</h2>
			<div class="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
				<Tooltip.Provider>
					<Tooltip.Root>
						<Tooltip.Trigger class="sm:text-right">
							<Button
								href="https://github.com/mapagmataas1331"
								variant="default"
								target="_blank"
								class="m-2 min-w-48 font-semibold shadow-lg hover:scale-105"
							>
								<Github class="mr-2 !size-6" />
								@mapagmataas1331
							</Button>
						</Tooltip.Trigger>
						<Tooltip.Content>
							<p>GitHub</p>
						</Tooltip.Content>
					</Tooltip.Root>
				</Tooltip.Provider>

				<Tooltip.Provider>
					<Tooltip.Root>
						<Tooltip.Trigger class="sm:text-left">
							<Button
								href="https://t.me/mapagmataas"
								variant="default"
								target="_blank"
								class="m-2 min-w-48 font-semibold shadow-lg hover:scale-105"
							>
								<Send class="mr-2 !size-6" />
								@mapagmataas
							</Button>
						</Tooltip.Trigger>
						<Tooltip.Content>
							<p>Telegram</p>
						</Tooltip.Content>
					</Tooltip.Root>
				</Tooltip.Provider>
			</div>
			<p
				id="legal"
				class="absolute bottom-0 left-0 right-0 p-2 text-center text-xs backdrop-blur-sm"
			>
				© ma.cyou (<a href="https://github.com/mapagmataas1331" target="_blank">Mapagmataas</a>),
				2024. All rights reserved.
			</p>
		</div>
	</section>
</div>
