(() => {
  'use strict';
  // Compact layers of photographic needles follow the same volume as the branches
  // that carry the nameplates and bulbs, all the way round the tree.
  window.addWishFirSurface = async function(api) {
    const T=api.THREE, tau=2*Math.PI, V=(x,y,z)=>new T.Vector3(x,y,z);
    const source=window.WISH_FIR_ASSETS || {};
    const loader=new T.TextureLoader();
    const [atlas,green,frost]=await Promise.all(['crown-albedo','sprig-green','sprig-snow'].map(
      key=>loader.loadAsync(source[key] || 'assets/environment/fir-'+key+'.webp')));
    [atlas,green,frost].forEach(t=>{t.colorSpace=T.SRGBColorSpace;t.anisotropy=4;});
    atlas.wrapS=T.RepeatWrapping;
    const old=api.treeRoot.getObjectByName('Modeled branch tiers with continuous bark-and-needle color');
    const foot=api.treeRoot.getObjectByName('Rooted fir trunk');
    if(foot)foot.userData.fixedTrunk=true;
    if(old)old.visible=false;
    const group=new T.Group();group.name='Photographic spruce boughs';
    api.treeRoot.add(group);
    let seed=271125;
    function random(){seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296;}
    const pockets=[];
    function collectMounts(){
      pockets.length=0;
      const ornaments=window.wishModelOrnaments;
      for(const w of ornaments?.list() || []){
        const p=ornaments.project(w.id);
        if(!p)continue;
        const print=api.rig.worldToLocal(new T.Vector3().fromArray(p.world));
        const anchor=new T.Vector3().fromArray(p.anchor);
        const mid=print.clone().lerp(anchor,.30);
        const r=Math.hypot(mid.x,mid.z);
        const lower=Math.min(print.y,anchor.y);
        const h=Math.abs(anchor.y-print.y);
        pockets.push({a:Math.atan2(mid.x,mid.z),y:(lower+anchor.y)*.5,halfY:Math.max(.062,h*.64),
          halfX:Math.max(.044,h*.39),r:Math.max(.05,Math.min(r,Math.hypot(print.x,print.z))-.024)});
      }
    }
    collectMounts();
    function clearance(a,y,r) {
      for(const p of pockets){
        const dy=Math.abs(y-p.y)/p.halfY;
        if(dy>1.45||r<p.r)continue;
        const da=Math.atan2(Math.sin(a-p.a),Math.cos(a-p.a));
        const d=Math.max(dy,Math.abs(da)*Math.max(r,.11)/p.halfX);
        if(d<1.45)r=T.MathUtils.lerp(p.r,r,T.MathUtils.smoothstep(d,.72,1.45));
      }
      return r;
    }
    function bodyRadius(y,a){
      const whorl=y*9.1+.30*Math.sin(a*3+y*2)+.095*Math.cos(a*9-y*1.7);
      const bumps=.5*Math.sin(whorl*tau)+.28*Math.sin(13*a+8*y)+.22*Math.cos(21*a-y*27);
      return api.canopyRadius(y)*(.915+.034*bumps);
    }
    const cols=160,rows=150,top=2.345,bottom=.062;
    const pos=[],uv=[],indices=[];
    for(let j=0;j<=rows;j++){
      const v=j/rows;
      for(let i=0;i<=cols;i++){
        const u=i/cols,a=(u-.5)*tau;
        // Organic lower edge curls up at the perimeter, away from the fixed trunk.
        const hem=(.012*Math.sin(11*a+.6*Math.sin(8*a))+.005*Math.sin(39*a))*Math.pow(1-v,12);
        const y=bottom+(top-bottom)*v+hem;
        const r=clearance(a,y,bodyRadius(y,a));
        pos.push(r*Math.sin(a),y,r*Math.cos(a));uv.push(u,v);
        const k=j*(cols+1)+i;
        if(j<rows&&i<cols)indices.push(k,k+1,k+cols+1,k+1,k+cols+2,k+cols+1);
      }
    }
    function meshGeometry(p,t,index){
      const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));
      g.setAttribute('uv',new T.Float32BufferAttribute(t,2));g.setIndex(index);g.computeVertexNormals();g.computeBoundingSphere();return g;
    }
    const crown=new T.Mesh(meshGeometry(pos,uv,indices),new T.MeshBasicMaterial({map:atlas,toneMapped:false,side:T.DoubleSide}));
    crown.name='Unbroken photographic fir crown';group.add(crown);
    const layers=[[],[]].map(()=>({p:[],uv:[],index:[],colors:[]}));
    // Fixed, arched radial branchlets. They overlap at different depths and
    // retain their real photographed margins in profile.
    for(let row=0;row<25;row++){
      const v=(row+.3)/25;const baseY=.11+2.19*v;
      const count=Math.round(11+32*(1-v)**.68);
      for(let j=0;j<count;j++){
        const a=(j+random()*.69)/count*tau+row*2.399963;
        const y=baseY+(random()-.5)*.072;
        const nominal=api.canopyRadius(y);
        const side=(random()<.5?-1:1),gain=.6+.4*random();
        const length=(.081+.153*(1-v))*(.76+.43*random());
        const width=length*(.38+.14*random());
        const rise=length*(-.24+.74*random()),sweep=side*length*(.46+.42*random());
        const a1=a+sweep/Math.max(nominal,.09);
        const r0=clearance(a,y,nominal*(.83+.045*random()));
        const r1=clearance(a1,y+rise,nominal*(.992+.051*random()));
        const foot=V(Math.sin(a)*r0,y,Math.cos(a)*r0);
        const tip=V(Math.sin(a1)*r1,y+rise,Math.cos(a1)*r1);
        const mid=foot.clone().lerp(tip,.52);mid.y+=length*(.015+.10*random());
        const direction=tip.clone().sub(foot).normalize();
        const face=V(Math.sin(a),.36+random()*.86,Math.cos(a)).normalize();
        const across=new T.Vector3().crossVectors(direction,face).normalize();
        across.applyAxisAngle(direction,(random()-.5)*.54);
        const frosted=(.52*Math.sin(a*4+row*.63)+random()*.83)>1.09;
        const data=layers[frosted?1:0],offset=data.p.length/3;
        const light=(frosted?.90:.78)+.19*gain;
        for(const [center,f,h] of [[foot,.93,0],[mid,1,.53],[tip,.72,1]]){
          for(const sign of [-1,1]){
            const pt=center.clone().addScaledVector(across,sign*f*width*.5);
            data.p.push(pt.x,pt.y,pt.z);data.uv.push(sign<0?0:1,h);
            data.colors.push(light,light*.975,light*.935);
          }
        }
        data.index.push(offset,offset+2,offset+1,offset+1,offset+2,offset+3,
          offset+2,offset+4,offset+3,offset+3,offset+4,offset+5);
      }
    }
    layers.forEach((d,i)=>{
      const g=meshGeometry(d.p,d.uv,d.index);
      g.setAttribute('color',new T.Float32BufferAttribute(d.colors,3));
      const mat=new T.MeshBasicMaterial({map:i?frost:green,alphaTest:.31,side:T.DoubleSide,toneMapped:false,vertexColors:true});
      const m=new T.Mesh(g,mat);m.name=i?'Snow on photographic branch tips':'Photographic needle tips';group.add(m);
    });
    return group;
  };
})();
