// $(".kutu1").click(function () {
//     $(".kutu1").css({
//         'filter': 'none'
//     });
// });

// console.log("testing");

document.querySelector('.kutu1').addEventListener('click', () => {
    document.querySelector('.kutu1').classList.add('kutu-changed');
    console.log("added");
});
