
    (() => {
      const doc = document.documentElement;
      const overflowX = doc.scrollWidth - doc.clientWidth;
      const parasitic = overflowX > 2;
      let clipped = 0, worst = null;
      document.querySelectorAll('body *').forEach(el => {
        const cs = getComputedStyle(el);
        if (cs.position === 'fixed' || cs.display === 'none') return;
        if (el.scrollWidth > el.clientWidth + 4 && el.clientWidth > 0) {
          clipped++;
          if (!worst || el.scrollWidth > worst.sw) worst = {
            tag: el.tagName, cls: (el.className||'').toString().slice(0,40),
            sw: el.scrollWidth, cw: el.clientWidth };
        }
      });
      return { overflowX, parasitic, clipped, worst,
               vw: window.innerWidth, vh: window.innerHeight };
    })()
    