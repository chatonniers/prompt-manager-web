import { useEffect, useRef } from 'react';

export function useSidebarResize(sidebarRef, collapsed) {
  const resizerRef = useRef(null);

  useEffect(() => {
    const sidebar = sidebarRef.current;
    const resizer = resizerRef.current;
    if (!sidebar || !resizer || collapsed) return;

    const saved = localStorage.getItem('pm-sidebar-width');
    if (saved) sidebar.style.width = saved + 'px';

    let dragging = false;

    function onDown(_e) {
      dragging = true;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }
    function onMove(e) {
      if (!dragging) return;
      const rect = sidebar.getBoundingClientRect();
      const w = Math.max(140, Math.min(400, e.clientX - rect.left));
      sidebar.style.width = w + 'px';
    }
    function onUp() {
      if (!dragging) return;
      dragging = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      const w = parseInt(sidebar.style.width);
      if (!isNaN(w)) localStorage.setItem('pm-sidebar-width', w);
    }

    resizer.addEventListener('mousedown', onDown);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      resizer.removeEventListener('mousedown', onDown);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, [sidebarRef, collapsed]);

  return resizerRef;
}
