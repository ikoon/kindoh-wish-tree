(() => {
  'use strict';
  // A trimming pass for fine needles immediately in front of the paper.
  // The recorded depth includes the actual printed cutout and its real folds.
  window.makeWishPrintClearance=function(api){
    const T=api.THREE,scene=new T.Scene(),proxies=new Map(),faceDirection=new T.Vector3();
    const rt=new T.WebGLRenderTarget(720,970,{minFilter:T.NearestFilter,magFilter:T.NearestFilter});
    rt.depthTexture=new T.DepthTexture(720,970,T.UnsignedIntType);
    rt.depthTexture.minFilter=rt.depthTexture.magFilter=T.NearestFilter;
    let dirty=true;
    function draw(force){
      const seen=new Set();api.rig.updateMatrixWorld(true);
      const assembly=api.rig.getObjectByName('physical-ornament-mounts');
      assembly?.traverse(m=>{
        if(!m.isMesh||!m.visible||!m.userData.id||!m.material?.map||!m.name.startsWith('printed-wish-relief'))return;
        seen.add(m.uuid);
        let copy=proxies.get(m.uuid);
        if(!copy){
          const mat=new T.MeshBasicMaterial({map:m.material.map,alphaTest:.52,side:T.FrontSide,depthWrite:true,colorWrite:false});
          copy=new T.Mesh(m.geometry,mat);copy.matrixAutoUpdate=false;scene.add(copy);proxies.set(m.uuid,copy);dirty=true;
        }
        if(copy.material.map!==m.material.map){copy.material.map=m.material.map;dirty=true;}
        copy.matrix.copy(m.matrixWorld);copy.matrixWorldNeedsUpdate=true;
        faceDirection.set(0,0,1).transformDirection(m.matrixWorld);
        copy.visible=faceDirection.z>.10;
      });
      for(const [id,m] of proxies)if(!seen.has(id)){scene.remove(m);m.material.dispose();proxies.delete(id);dirty=true;}
      if(!force&&!dirty)return;
      dirty=false;
      const previous=api.renderer.getRenderTarget();
      api.renderer.setRenderTarget(rt);api.renderer.render(scene,api.camera);api.renderer.setRenderTarget(previous);
    }
    window.addEventListener('wish:tilt',()=>{dirty=true;});
    window.addEventListener('wish:front-ink',()=>{dirty=true;});
    api.scene.onBeforeRender=()=>draw(false);
    return {depth:rt.depthTexture,draw};
  };
})();
