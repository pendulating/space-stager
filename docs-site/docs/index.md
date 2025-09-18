---
title: Space Stager
slug: /
---

<div style={{display:'grid',gap:'1.25rem',placeItems:'center',textAlign:'center',padding:'2rem 0'}}>
  <img src="/docs/img/logo.svg" alt="Space Stager" width="72" height="72" />
  <h1 style={{margin:'0.25rem 0'}}>Space Stager Documentation</h1>
  <p style={{maxWidth:780,margin:'0 auto',opacity:.85}}>
    Plan public‑space events with a fast, map‑first workflow. Place objects, annotate, validate,
    and export blueprint‑style site plans for permitting.
  </p>
  <div style={{display:'flex',gap:'0.75rem',flexWrap:'wrap',justifyContent:'center',marginTop:'0.5rem'}}>
    <a className="button button--primary" href="/docs/user-guide/getting-started">Get Started</a>
    <a className="button button--secondary" href="/docs/developer-guide/map-integration">Developer Guide</a>
    <a className="button" href="/docs/tutorials/sapo-walkthrough">SAPO Walkthrough</a>
  </div>
</div>

<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))',gap:'1rem',marginTop:'1rem'}}>
  <div className="card">
    <div className="card__header"><h3>User Guide</h3></div>
    <div className="card__body">
      <ul>
        <li><a href="/docs/user-guide/map-basics">Map basics</a></li>
        <li><a href="/docs/user-guide/permit-areas">Permit areas</a></li>
        <li><a href="/docs/user-guide/placing-objects">Placing objects</a></li>
        <li><a href="/docs/user-guide/drawing-tools">Annotations</a></li>
        <li><a href="/docs/user-guide/exporting">Exporting</a></li>
      </ul>
    </div>
  </div>
  <div className="card">
    <div className="card__header"><h3>Developer Guide</h3></div>
    <div className="card__body">
      <ul>
        <li><a href="/docs/developer-guide/map-integration">Map integration</a></li>
        <li><a href="/docs/developer-guide/draw-tools">Draw tools</a></li>
        <li><a href="/docs/developer-guide/permit-areas">Permit areas flow</a></li>
        <li><a href="/docs/developer-guide/infrastructure-service">Infrastructure service</a></li>
        <li><a href="/docs/developer-guide/export-pipeline">Export pipeline</a></li>
      </ul>
    </div>
  </div>
  <div className="card">
    <div className="card__header"><h3>Reference</h3></div>
    <div className="card__body">
      <ul>
        <li><a href="/docs/reference/layers">Layers</a> · <a href="/docs/reference/endpoints">Endpoints</a></li>
        <li><a href="/docs/reference/placeable-objects">Placeable objects</a></li>
        <li><a href="/docs/api/components">React components</a></li>
        <li><a href="/docs/api/js-api">JS API</a></li>
      </ul>
    </div>
  </div>
</div>

<div style={{marginTop:'2rem',display:'grid',placeItems:'center'}}>
  <img src="/docs/sapo_walkthrough_15fps.gif" alt="SAPO Walkthrough" style={{maxWidth:'720px',width:'100%',borderRadius:8,boxShadow:'0 2px 8px rgba(0,0,0,.12)'}} />
</div>


