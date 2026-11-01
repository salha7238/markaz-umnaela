// Official Ministry of Education Logo (High Resolution Vector SVG Data URL)

const SVG_MOE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
  <defs>
    <style>
      @import url("https://fonts.googleapis.com/css2?family=Cairo:wght@700;800;900&amp;family=Tajawal:wght@500;700&amp;display=swap");
      .moe-title {
        font-family: "Cairo", "Tajawal", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        font-weight: 800;
        font-size: 88px;
        fill: #13837a;
      }
      .moe-sub {
        font-family: "Tajawal", "Cairo", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        font-weight: 600;
        font-size: 40px;
        fill: #158b81;
        letter-spacing: 1.5px;
      }
    </style>
  </defs>

  <!-- Group of Canopy Dots representing the Book of Knowledge -->
  <g id="canopy-dots">
    <!-- Top Row - Left Wing -->
    <circle cx="110" cy="110" r="23" fill="#148072" />
    <circle cx="170" cy="120" r="20" fill="#188f80" />
    <circle cx="230" cy="140" r="18" fill="#1c9c8c" />
    <circle cx="290" cy="170" r="16" fill="#20a998" />
    <circle cx="340" cy="210" r="14" fill="#25b7a5" />
    <circle cx="385" cy="245" r="11" fill="#2cc4b2" />
    <circle cx="425" cy="275" r="9"  fill="#35d1bf" />

    <!-- Top Row - Right Wing (Symmetric) -->
    <circle cx="690" cy="110" r="23" fill="#148072" />
    <circle cx="630" cy="120" r="20" fill="#188f80" />
    <circle cx="570" cy="140" r="18" fill="#1c9c8c" />
    <circle cx="510" cy="170" r="16" fill="#20a998" />
    <circle cx="460" cy="210" r="14" fill="#25b7a5" />
    <circle cx="415" cy="245" r="11" fill="#2cc4b2" />
    <circle cx="375" cy="275" r="9"  fill="#35d1bf" />

    <!-- Second Row - Left Wing -->
    <circle cx="110" cy="190" r="23" fill="#137b6d" />
    <circle cx="170" cy="195" r="20" fill="#178879" />
    <circle cx="230" cy="210" r="18" fill="#1b9585" />
    <circle cx="290" cy="235" r="16" fill="#1fa191" />
    <circle cx="345" cy="270" r="13" fill="#24af9e" />
    <circle cx="400" cy="305" r="11" fill="#2abda9" />

    <!-- Second Row - Right Wing -->
    <circle cx="690" cy="190" r="23" fill="#137b6d" />
    <circle cx="630" cy="195" r="20" fill="#178879" />
    <circle cx="570" cy="210" r="18" fill="#1b9585" />
    <circle cx="510" cy="235" r="16" fill="#1fa191" />
    <circle cx="455" cy="270" r="13" fill="#24af9e" />
    <circle cx="400" cy="305" r="11" fill="#2abda9" />

    <!-- Third Row - Left Wing -->
    <circle cx="110" cy="270" r="23" fill="#127467" />
    <circle cx="170" cy="275" r="20" fill="#157f71" />
    <circle cx="230" cy="285" r="18" fill="#198c7d" />
    <circle cx="290" cy="305" r="15" fill="#1d9787" />
    <circle cx="345" cy="335" r="13" fill="#21a393" />

    <!-- Third Row - Right Wing -->
    <circle cx="690" cy="270" r="23" fill="#127467" />
    <circle cx="630" cy="275" r="20" fill="#157f71" />
    <circle cx="570" cy="285" r="18" fill="#198c7d" />
    <circle cx="510" cy="305" r="15" fill="#1d9787" />
    <circle cx="455" cy="335" r="13" fill="#21a393" />

    <!-- Lower Center Valley Dots -->
    <circle cx="280" cy="365" r="13" fill="#1c9888" />
    <circle cx="340" cy="385" r="11" fill="#20a292" />
    <circle cx="400" cy="415" r="11" fill="#25ad9c" />
    <circle cx="460" cy="385" r="11" fill="#20a292" />
    <circle cx="520" cy="365" r="13" fill="#1c9888" />
  </g>

  <!-- Typography -->
  <text x="400" y="495" text-anchor="middle" class="moe-title">وزارة الـتـعـلـيـم</text>
  <text x="400" y="555" text-anchor="middle" class="moe-sub">Ministry of Education</text>
</svg>`;

export const MOE_LOGO = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(SVG_MOE)}`;
export const PROG_LOGO = MOE_LOGO;
