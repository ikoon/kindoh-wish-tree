(() => {
  'use strict';
  const stage=document.getElementById('original-tree-view');
  const photo=stage?.querySelector('.original-tree-photo');
  if(!photo||!window.wishTreeModel)return;
  const radians=Math.PI/180;
  const signed=angle=>((angle+540)%360)-180;
  function face(angle){stage.dataset.designFace=Math.abs(signed(angle))<.015?'original':'turned';}
  face(window.wishTreeModel.getAngle());
  window.addEventListener('wish:tilt',e=>face(e.detail.angle));
  window.wishTreeModel.onReady(api=>prepare(api).catch(error=>{
    console.warn('Reference foliage could not be loaded',error);
    stage.dataset.frontProjection='fallback';
    api.requestRender();
  }));
  async function prepare(api){
    const T=api.THREE,rig=api.rig,camera=api.camera,loader=new T.TextureLoader();
    const files=window.WISH_FIR_ASSETS||{},frontFiles=window.WISH_FRONT_LAYERS||{};
    const [whole,needles]=await Promise.all([
      loader.loadAsync(frontFiles.mask||'assets/environment/front-mask.webp'),
      loader.loadAsync(files['front-detail']||'assets/environment/fir-front-detail.webp'),
      photo.decode(),window.addWishFirSurface(api)
    ]);
    // Actual printed meshes must participate in the reference depth capture.
    // Rendering the tree itself remains available while their ink is decoding.
    for(let i=0;i<140 && (window.wishModelOrnaments?.printed||0)<(window.wishModelOrnaments?.count||1);i++)
      await new Promise(r=>setTimeout(r,40));
    const W=1440,H=1940,ink=document.createElement('canvas');
    ink.width=W;ink.height=H;
    const ctx=ink.getContext('2d'),picture=new T.CanvasTexture(ink);
    picture.colorSpace=T.SRGBColorSpace;picture.anisotropy=4;
    function write(){
      ctx.drawImage(photo,0,0,W,H);window.paintWishFront?.(ctx);picture.needsUpdate=true;
    }
    write();
    // Ease between the photograph and its moving surfaces over the first
    // two degrees, including the light that falls on the photographed needles.
    const firstTurn=document.createElement('div');
    firstTurn.className='first-turn-photo';firstTurn.setAttribute('aria-hidden','true');
    const lightLayer=stage.querySelector('.front-lamp-exposure').cloneNode(false);
    lightLayer.className='first-turn-light';firstTurn.hidden=true;
    firstTurn.append(ink,lightLayer);stage.append(firstTurn);
    const depth=new T.WebGLRenderTarget(W,H,{minFilter:T.NearestFilter,magFilter:T.NearestFilter});
    depth.depthTexture=new T.DepthTexture(W,H,T.UnsignedIntType);
    depth.depthTexture.minFilter=depth.depthTexture.magFilter=T.NearestFilter;
    const restView=new T.Matrix4(),invRig=new T.Matrix4();
    const projection={value:restView},exposure={value:1},nearFront={value:1},depthSampler={value:null};
    const trim=window.makeWishPrintClearance(api),spill=window.wishLampSpill(api);
    // Keep the lit portions of the garland behind the paper and the character
    // hung over it. The real alpha cutout leaves the gaps between ornaments open.
    const viewport=new T.Vector4(),lampViewport={value:new T.Vector2(1,1)};
    const printUniforms={wishLampViewport:lampViewport,wishPrintedPaper:{value:trim.depth}};
    function clipLamp(shader){
      Object.assign(shader.uniforms,printUniforms);
      shader.fragmentShader='uniform sampler2D wishPrintedPaper;uniform vec2 wishLampViewport;\n'+
        shader.fragmentShader.replace(/void main\s*\(\s*\)\s*\{/, `void main(){
          float printDepth=texture2D(wishPrintedPaper,gl_FragCoord.xy/wishLampViewport).r;
          if(printDepth<.9999 && printDepth-gl_FragCoord.z<.058)discard;`);
    }
    for(const name of ['Illuminated fairy light beads','Tiny brass-backed LED sockets','Warm amber light on surrounding needles']){
      const lamp=api.treeRoot.getObjectByName(name);if(!lamp)continue;
      const material=lamp.material,existingRender=lamp.onBeforeRender;
      lamp.onBeforeRender=function(renderer,...args){
        existingRender.call(this,renderer,...args);renderer.getCurrentViewport(viewport);
        lampViewport.value.set(viewport.z,viewport.w);
      };
      if(material.isShaderMaterial)clipLamp(material);
      else{
        const prev=material.onBeforeCompile,key=material.customProgramCacheKey();
        material.onBeforeCompile=function(shader,renderer){prev.call(this,shader,renderer);clipLamp(shader);};
        material.customProgramCacheKey=()=>key+'-printed-wish-occlusion';
      }
      material.needsUpdate=true;
    }
    const toLocal={value:new T.Matrix4()};
    const restored=rig.rotation.y,oldTarget=api.renderer.getRenderTarget();
    camera.updateMatrixWorld(true);
    const installed=new WeakSet();
    function registerMaterials(){
      const records=new Map((window.wishModelOrnaments?.list()||[]).map(w=>[w.id,w]));
      rig.traverse(m=>{
        if(!m.isMesh)return;
        // The photographed colors describe reflecting surfaces. Placing the photo
        // on an emitting LED would extinguish that light at front-facing angles.
        if(m.name==='Illuminated fairy light beads'||m.name==='Tiny brass-backed LED sockets')return;
        if(m.userData.nativeWishPhoto){
          const w=records.get(m.userData.id);
          const isOnSource=w && window.WISH_FRONT_PLACES[w.art]?.[w.slot] && w.poseKey===w.art+':'+w.slot;
          // A sheet hidden behind the front boughs in the photograph comes
          // into view from its own branch as the viewer turns around the tree.
          if(isOnSource || m.name!=='printed-wish-relief')return;
        }
        for(const mat of Array.isArray(m.material)?m.material:[m.material]){
          if(!mat||mat.isShaderMaterial||installed.has(mat))continue;
          installed.add(mat);
          const bark=m.userData.fixedTrunk||mat.name==='tree_bark_0';
          const art=!!m.userData.id||/gold Christmas star/i.test(m.parent?.name||'') || /glass|bauble|flut|ribbon|gold|lamp|bulb|star|velvet|champagne/i.test(m.name+' '+mat.name);
          const detailOnly=!art;
          const prev=mat.onBeforeCompile;
          const cache=mat.customProgramCacheKey();
          mat.customProgramCacheKey=()=>cache+'source-registered-fir-6'+(bark?'B':detailOnly?'N':'D');
          mat.onBeforeCompile=function(s,renderer){
            prev?.call(this,s,renderer);
            Object.assign(s.uniforms,{uSourceMatrix:projection,uSourceImg:{value:picture},
              uToLocal:toLocal,uLampSpill:spill.intensity,uSpill:{value:spill.map},uSourceMask:{value:whole},uNeedleDetail:{value:needles},uRegisteredNear:nearFront,uClearance:{value:trim.depth},uSourceDepth:depthSampler,uSourceEnergy:exposure});
            s.vertexShader='uniform mat4 uSourceMatrix,uToLocal; varying vec3 vCanopyPoint; varying vec4 vOriginal;varying vec4 vCardClip;\n'+s.vertexShader.replace(
              '#include <project_vertex>','#include <project_vertex>\n vOriginal=uSourceMatrix*mvPosition;vCardClip=gl_Position;vCanopyPoint=(uToLocal*mvPosition).xyz;');
            s.fragmentShader='varying vec4 vOriginal; varying vec3 vCanopyPoint; varying vec4 vCardClip; uniform sampler2D uSpill,uClearance,uNeedleDetail; uniform float uRegisteredNear,uLampSpill; uniform sampler2D uSourceMask,uSourceDepth,uSourceImg; uniform float uSourceEnergy;\n'+s.fragmentShader.replace('#include <colorspace_fragment>',`
              ${detailOnly?`vec3 inkClip=.5*(vCardClip.xyz/vCardClip.w+1.);float paper=texture2D(uClearance,inkClip.xy).x;
              float inFront=paper-inkClip.z;if(paper<.999 && inFront>-.000025 && inFront<.0095)discard;
              vec2 lampUv=vec2(atan(vCanopyPoint.x,vCanopyPoint.z)/6.2831853+.5,(vCanopyPoint.y+.04)/2.49);
              float spill=texture2D(uSpill,lampUv).r;
              `:''}
              vec3 originalNdc=vOriginal.xyz/vOriginal.w*.5+.5;
              vec2 origUv=originalNdc.xy;
              ${bark?'if(origUv.y<.182) discard;':''}
              float inPhoto=step(0.,origUv.x)*step(origUv.x,1.)*step(0.,origUv.y)*step(origUv.y,1.);
              float seen=texture2D(uSourceDepth,origUv).x;
              float visible=1.-smoothstep(.00026,.0018,abs(seen-originalNdc.z));
              vec2 projected=vCardClip.xy/vCardClip.w*.5+.5;
              vec2 screenScale=1./max(vec2(abs(dFdx(projected.x)),abs(dFdy(projected.y))),vec2(.000001));
              vec2 dX=dFdx(origUv)*screenScale, dY=dFdy(origUv)*screenScale;
              float stretch=max(length(dX),length(dY));
              float density=(dX.x*dY.y-dX.y*dY.x)/max(.001,stretch);
              float fidelity=smoothstep(.52,.90,density)*(1.-smoothstep(1.7,3.2,stretch));
              float mask=mix(texture2D(uSourceMask,origUv).r,1.,uRegisteredNear);
              ${detailOnly?'mask=mix(texture2D(uNeedleDetail,origUv).r,mask,uRegisteredNear);':'mask*=uRegisteredNear;'}
              float coverage=mask*visible*inPhoto*fidelity;
              vec3 registeredColor=texture2D(uSourceImg,origUv).rgb;
              gl_FragColor.rgb=mix(gl_FragColor.rgb,registeredColor,coverage*uSourceEnergy);
              ${detailOnly?`float needleValue=dot(gl_FragColor.rgb,vec3(.29,.59,.12));
              // The same nearby LED also illuminates the needles visible in the photograph.
              gl_FragColor.rgb+=uLampSpill*spill*vec3(.36,.151,.026)*(.105+clamp(3.45*sqrt(max(.0,needleValue)),.0,1.34));`:''}
              #include <colorspace_fragment>
            `);
          };
          mat.needsUpdate=true;
        }
      });
    }
    registerMaterials();
    // Capture with the final paper clearance active. A branch that was
    // trimmed away must not prevent its newly visible plaque from receiving ink.
    const white=new T.DataTexture(new Uint8Array([255,255,255,255]),1,1);
    white.needsUpdate=true;depthSampler.value=white;exposure.value=0;
    restView.copy(camera.projectionMatrix);toLocal.value.copy(camera.matrixWorld);
    rig.rotation.y=0;rig.updateMatrixWorld(true);trim.draw(true);
    api.renderer.setRenderTarget(depth);api.renderer.render(api.scene,camera);
    api.renderer.setRenderTarget(oldTarget);
    rig.rotation.y=restored;rig.updateMatrixWorld(true);trim.draw(true);
    depthSampler.value=depth.depthTexture;exposure.value=1;white.dispose();
    // Source needles beyond the mesh's irregular outline occupy their own
    // registered object-space positions. The stationary trunk is never in
    // this geometry. New branches naturally pass in front as the tree turns.
    const fringe=new T.PlaneGeometry(1,1,116,156),coords=fringe.attributes.position,uv=fringe.attributes.uv;
    const p=new T.Vector3(),dir=camera.getWorldDirection(new T.Vector3());
    const frontBasis=new T.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
    for(let i=0;i<coords.count;i++){
      const x=uv.getX(i),y=uv.getY(i);
      p.set(2*x-1,2*y-1,0).unproject(camera);
      const radius=api.canopyRadius(p.y);
      const edge=Math.sqrt(Math.max(0,radius*radius-p.x*p.x));
      const z=Math.min(edge,radius*.54);
      p.addScaledVector(dir,(z-p.z)/dir.z);coords.setXYZ(i,p.x,p.y,p.z);
    }
    coords.needsUpdate=true;fringe.computeBoundingSphere();
    const fringeMat=new T.ShaderMaterial({uniforms:{refPhoto:{value:picture},edgeMask:{value:whole},needleMask:{value:needles},nearest:nearFront,depthRef:depthSampler,
      sideWeight:{value:1}},vertexShader:'varying vec2 refUv; void main(){refUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:`varying vec2 refUv;uniform sampler2D refPhoto,edgeMask,needleMask,depthRef;uniform float sideWeight,nearest;
        void main(){
          if(texture2D(depthRef,refUv).r<.9999)discard;
          float mask=mix(texture2D(needleMask,refUv).r,texture2D(edgeMask,refUv).r,nearest);
          // Never rotate the root, the parcel shadows, or the snow at their feet.
          float root=(1.-smoothstep(.043,.087,abs(refUv.x-.506)))*(1.-smoothstep(.14,.211,refUv.y));
          mask*=1.-root;
          if(refUv.y<.11)discard;
          float a=mask*sideWeight;
          if(a<.04)discard;
          gl_FragColor=vec4(texture2D(refPhoto,refUv).rgb,a);
          #include <colorspace_fragment>
        }`, side:T.DoubleSide,transparent:true,depthTest:true,depthWrite:false,toneMapped:false});
    const rim=new T.Mesh(fringe,fringeMat);rim.name='Photographed front needle fringe';rim.userData.referenceOnly=true;rim.renderOrder=1;rig.add(rim);
    // Every solid and its writing turn in the same world coordinate system.
    // The front photograph is a source of surface color, never a second scene.
    function update(angle){
      const a=Math.abs(signed(angle));
      firstTurn.hidden=a<.015||a>=2.4;
      if(!firstTurn.hidden)firstTurn.style.opacity=String(1-T.MathUtils.smoothstep(a,.015,2.4));
      invRig.copy(rig.matrixWorld).invert();
      toLocal.value.copy(invRig).multiply(camera.matrixWorld);
      restView.copy(frontBasis).multiply(toLocal.value);spill.update();
      exposure.value=1-T.MathUtils.smoothstep(a,32,101);
      nearFront.value=1-T.MathUtils.smoothstep(a,1.5,11);
      fringeMat.uniforms.sideWeight.value=1-T.MathUtils.smoothstep(a,8,46);
      rim.visible=fringeMat.uniforms.sideWeight.value>.004;
    }
    let lastIds='';
    function refreshInk(){
      const now=Array.from(stage.querySelectorAll('.original-wish-hit'),b=>b.dataset.wishId+'|'+b.querySelector('span')?.dataset.message).join('/');
      if(now!==lastIds){write();lastIds=now;}
      registerMaterials();api.requestRender();
    }
    // At shallow angles a readable front plaque can sit behind a single
    // needle. Favor its actual projected printed center when tapping the ink.
    window.pickPhotographicWish=(x,y)=>{
      const a=Math.abs(signed(api.getAngle()));if(a>35)return null;
      let best=null,z=-Infinity;
      const ornaments=window.wishModelOrnaments;
      for(const w of ornaments?.list()||[]){
        const ref=window.WISH_FRONT_PLACES[w.art]?.[w.slot];
        if(!ref||w.poseKey!==w.art+':'+w.slot)continue;
        const p=ornaments.project(w.id);
        if(!p||p.facing<.13)continue;
        const alpha=ref[4]*radians,dx=(x-p.x)*W/Math.cos(a*radians),dy=(y-p.y)*H;
        const lx=dx*Math.cos(alpha)+dy*Math.sin(alpha),ly=dy*Math.cos(alpha)-dx*Math.sin(alpha);
        if((lx/(ref[2]*.54))**2+(ly/(ref[3]*.65))**2<=1 && p.world[2]>z){best=w.id;z=p.world[2];}
      }
      return best;
    };
    window.addEventListener('wish:front-ink',refreshInk);
    window.addEventListener('wish:tilt',e=>update(e.detail.angle));
    update(api.getAngle());refreshInk();stage.dataset.frontProjection='ready';api.requestRender();
  }
})();
