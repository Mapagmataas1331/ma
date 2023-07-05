trans_arr.push(
  "Name: <b>Anashin Timofey</b>", "Имя: <b>Анашин Тимофей</b>",
  "Username: <b>Mapagmataas</b>", "Никнейм: <b>Mapagmataas</b>",
  "Age: <b>19</b> (12.13.2003)", "Возраст: <b>19</b> (13.12.2003)",
  "Location: Russia, <b>Novosibirsk</b>", "Город: <b>Новосибирск</b>",
  "<b>Education:</b>", "<b>Образование:</b>",
  "Novocollege KIT(College of Information Technology)", "КИТ (Колледж информационных технологий) Новоколледж",
  "Degree in Information Systems and Programming", "Диплом по информационным системам и программированию",
  "Expected Graduation: 2025", "Ожидаемая дата окончания: 2025",
  "<b>Skills:</b>", "<b>Навыки:</b>",
  "Programming Languages: HTML, JavaScript, C, Golang, C#, Python, SQL", "Языки программирования: HTML, JavaScript, C, Golang, C#, Python, SQL",
  "Familiarity with C++ and Rust", "Знаком с C++ и Rust",
  "Problem-solving and analytical thinking", "Умение решать проблемы и аналитическое мышление",
  "Strong attention to detail", "Внимательность к деталям",
  "Ability to work both independently and in a team", "Способность работать как самостоятельно, так и в команде",
  "Excellent communication and interpersonal skills", "Отличные навыки коммуникации и взаимодействия",
  "<b>Projects:</b>", "<b>Проекты:</b>",
  "[Project Name]", "[Название проекта]",
  "Description: [Briefly describe the project and your role in it]", "Описание: [Краткое описание проекта и ваша роль в нем]",
  "Technologies used: [List the programming languages and tools used]", "Используемые технологии: [Перечислите используемые языки программирования и инструменты]",
  "[Project Name]", "[Название проекта]",
  "Description: [Briefly describe the project and your role in it]", "Описание: [Краткое описание проекта и ваша роль в нем]",
  "Technologies used: [List the programming languages and tools used]", "Используемые технологии: [Перечислите используемые языки программирования и инструменты]",
  "<b>Languages:</b>", "<b>Языки:</b>",
  "Russian (Native proficiency)", "Русский (Родной язык)",
  "English (Fluent)", "Английский (Беглое владение)",
  "<b>Contact Information:</b>", "<b>Контактная информация:</b>",
  "Email: ma.group.box@gmail.com", "Email: ma.group.box@gmail.com",
  "Telegram: @mapagmataas", "Telegram: @mapagmataas",
);

var numSquares = 250;
var background = document.querySelector('#background');

for (var i = 0; i < numSquares; i++) {
  var square = document.createElement('div');
  square.className = 'square';
  square.style.top = Math.floor(Math.random() * 25) * 4 + '%';
  square.style.left = Math.floor(Math.random() * 25) * 4 + '%';
  background.appendChild(square);
}