document.addEventListener("mousemove", (e)=>{
  const glow = document.getElementById("mouse-glow");
  if(!glow) return;
  glow.style.left = e.pageX + "px";
  glow.style.top = e.pageY + "px";
});

let clickAudio = null;
function playClick(){
  if(!clickAudio){
    clickAudio = new Audio("/sfx/click.mp3");
  }
  try{
    clickAudio.currentTime = 0;
    clickAudio.play();
  }catch{}
}
document.addEventListener("click", ()=>playClick());
