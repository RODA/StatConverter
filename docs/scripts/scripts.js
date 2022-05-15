// initialy opened
if (localStorage.getItem("st_nav") === null) {
	localStorage.setItem("st_nav", "opened");
}

function toggleNavigation() {
	let navIs = localStorage.getItem("st_nav");
	// console.log(navIs);
	// if (navIs === null) {
	//     localStorage.setItem('st_nav', 'closed');
	//     document.getElementById("page").classList.remove("open-menu");
	// } else {
	if (navIs == "closed") {
		document.getElementById("page").classList.add("open-menu");
		localStorage.setItem("st_nav", "opened");
	} else {
		// document.getElementById("st-sidebar").style.left = "-100%";
		// document.getElementById("main").style.marginLeft = "0";
		document.getElementById("page").classList.remove("open-menu");
		localStorage.setItem("st_nav", "closed");
	}
	// }
}
document.addEventListener("DOMContentLoaded", () => {
	let navIs = localStorage.getItem("st_nav");
	if (navIs !== null) {
		console.log(navIs);
		if (navIs != "closed") {
			// document.getElementById("st-sidebar").style.left = "0px";
			// document.getElementById("main").style.marginLeft = "calc(100% - 60px)";
			document.getElementById("page").classList.add("open-menu");
		} else {
			// document.getElementById("st-sidebar").style.left = "-100%";
			// document.getElementById("main").style.marginLeft = "0";
			document.getElementById("page").classList.remove("open-menu");
		}
	}
});
