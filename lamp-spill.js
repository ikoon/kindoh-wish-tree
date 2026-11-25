(() => {
  'use strict';
  // This texture represents incident amber light in azimuth and height. It
  // rotates with the tree. It never paints an extra bulb or a camera-facing disk.
  const maps=new WeakMap();
  window.wishLampSpill=function(api){
    const cached=maps.get(api);if(cached)return cached;
    const T=api.THREE,W=1024,H=640,canvas=document.createElement('canvas');
    canvas.width=W;canvas.height=H;
    const ctx=canvas.getContext('2d'),texture=new T.CanvasTexture(canvas);
    texture.wrapS=T.RepeatWrapping;texture.generateMipmaps=false;
    texture.minFilter=T.LinearFilter;texture.magFilter=T.LinearFilter;
    const transform=new T.Matrix4(),point=new T.Vector3();
    let revision=-1;
    function update(){
      const lamps=api.treeRoot.getObjectByName('Illuminated fairy light beads');
      if(!lamps?.isInstancedMesh || lamps.instanceMatrix.version===revision)return;
      revision=lamps.instanceMatrix.version;
      ctx.globalCompositeOperation='source-over';ctx.fillStyle='black';ctx.fillRect(0,0,W,H);
      ctx.globalCompositeOperation='lighter';
      for(let i=0;i<lamps.count;i++){
        lamps.getMatrixAt(i,transform);point.setFromMatrixPosition(transform);
        const radial=Math.max(.09,Math.hypot(point.x,point.z)),a=Math.atan2(point.x,point.z);
        const x=W*(a/(2*Math.PI)+.5),y=H*(1-(point.y+.04)/2.49);
        const reach=.086+.032*(.5+.5*Math.cos(i*2.879));
        const radiusX=Math.min(W*.21,reach*W/(2*Math.PI*radial)),radiusY=reach*H/2.49;
        for(const shift of [0,-W,W]){
          if(x+shift+radiusX<0||x+shift-radiusX>=W)continue;
          ctx.save();ctx.translate(x+shift,y);ctx.scale(radiusX,radiusY);
          const g=ctx.createRadialGradient(0,0,0,0,0,1);
          g.addColorStop(0,'rgb(255,255,255)');g.addColorStop(.17,'rgb(207,207,207)');
          g.addColorStop(.46,'rgb(98,98,98)');g.addColorStop(.76,'rgb(26,26,26)');g.addColorStop(1,'black');
          ctx.fillStyle=g;ctx.fillRect(-1,-1,2,2);ctx.restore();
        }
      }
      texture.needsUpdate=true;
    }
    update();
    window.addEventListener('wish:lighting-ready',update);
    const spill={map:texture,intensity:{value:1},update};
    maps.set(api,spill);return spill;
  };
})();
