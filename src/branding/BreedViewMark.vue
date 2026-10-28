<!--
  BreedView's mark: a leaf on its side whose veins are a graph, with an eye at the graph's junction. It is one colour,
  the text colour around it (the header's, as a branding sets it), with the graph and the eye cut through to whatever
  is behind, so it goes on any header. The leaf's path is in millimetres, its tip at the origin; public/favicon.svg is
  the same mark on a square.
-->
<template>
  <svg class="breedview-mark" viewBox="2 16 60 32" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">
    <mask id="breedview-mark-cut" maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64">
      <g transform="translate(61 32) rotate(90) scale(0.817)">
        <path d="M0 0C0 0 17.4 9.4 18 30.3C18.4 52 0 70.85 0 70.85C0 70.85-18.4 52-18 30.3C-17.4 9.4 0 0 0 0Z" fill="#fff"/>
        <g fill="#000">
          <path d="M0 35.3L0 5.4M0 35.3L-12.5 22.8M0 35.3L12.5 22.8M0 35.3L0 63.6" stroke="#000" stroke-width="2.45" stroke-linecap="round"/>
          <circle cx="0" cy="5.4" r="3.67"/>
          <circle cx="-12.5" cy="22.8" r="3.67"/>
          <circle cx="12.5" cy="22.8" r="3.67"/>
          <circle cx="0" cy="63.6" r="3.67"/>
          <circle cx="0" cy="35.3" r="12.12"/>
        </g>
        <path d="M0 35.3L0 23.67M0 35.3L-8.22 27.08M0 35.3L8.22 27.08M0 35.3L0 46.93" stroke="#fff" stroke-width="2.45"/>
        <circle cx="0" cy="35.3" r="3.67" fill="#fff"/>
      </g>
    </mask>
    <rect width="64" height="64" fill="currentColor" mask="url(#breedview-mark-cut)"/>
  </svg>
</template>
