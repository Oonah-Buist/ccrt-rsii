// Simple JotForm embed for Contact page with auto-resize and borderless styling
(function(){
  function setupAutoResize() {
    // Add a robust postMessage listener to resize JotForm iframes
    function handleIFrameMessage(e) {
      if (!e || !e.data) return;
      var data = e.data;
      try {
        // JotForm sometimes sends JSON
        if (typeof data === 'string' && data.charAt(0) === '{') {
          data = JSON.parse(data);
        }
      } catch (err) {
        // ignore JSON parse errors
      }

      var iframes = document.querySelectorAll("#contactFormEmbed iframe[src*='jotform.'], #contactFormEmbed iframe[src*='jotformeu.'], #contactFormEmbed iframe[src*='jotformme.']");
      if (!iframes.length) return;

      // String protocol: "setHeight:FORMID:HEIGHT" and others
      if (typeof data === 'string') {
        var args = data.split(':');
        var action = args[0];
        if (action === 'setHeight') {
          var formId = args[1];
          var height = parseInt(args[2], 10);
          if (!isNaN(height)) {
            var target = document.getElementById('JotFormIFrame-' + formId) || iframes[0];
            if (target) target.style.height = height + 'px';
          }
        } else if (action === 'scrollIntoView') {
          iframes[0].scrollIntoView && iframes[0].scrollIntoView();
        }
        return;
      }

      // Object protocol (future-proof)
      if (typeof data === 'object') {
        if (data.type === 'jotform:setHeight' && data.height) {
          var target2 = document.getElementById(data.id) || iframes[0];
          if (target2) target2.style.height = parseInt(data.height, 10) + 'px';
        } else if (data.type === 'jotform:scrollIntoView') {
          iframes[0].scrollIntoView && iframes[0].scrollIntoView();
        }
      }
    }

    if (!window.__jotform_autoResizeBound) {
      window.addEventListener('message', handleIFrameMessage, false);
      window.__jotform_autoResizeBound = true;
    }

    // Ensure borderless styles
    var s = document.createElement('style');
    s.textContent = "#contactFormEmbed iframe{border:0!important;box-shadow:none!important;display:block;width:1px;min-width:100%;}";
    document.head.appendChild(s);
  }

  document.addEventListener('DOMContentLoaded', function(){
    var container = document.getElementById('contactFormEmbed');
    if (!container) return;

    setupAutoResize();

    var embed = (window.JOTFORM_CONTACT_EMBED || '').trim();
    if (!embed) {
      container.innerHTML = '<p style="color:#c62828">Contact form is not configured.</p>';
      return;
    }

    // If full script or iframe snippet provided, insert as-is
    if (embed.includes('<script') || embed.includes('<iframe')) {
      container.innerHTML = embed;
      return;
    }

    // If a direct URL or an ID is provided, build an iframe
    var idMatch = embed.match(/(\d{8,})/);
    var formId = idMatch ? idMatch[1] : null;
    if (!formId) {
      container.innerHTML = '<p style="color:#c62828">Invalid JotForm embed or ID.</p>';
      return;
    }

    var src = 'https://form.jotform.com/' + formId;
    var iframe = document.createElement('iframe');
    iframe.id = 'JotFormIFrame-' + formId;
    iframe.title = 'Contact form';
    iframe.allow = 'geolocation; microphone; camera; fullscreen; payment';
    iframe.setAttribute('allowtransparency', 'true');
    iframe.setAttribute('frameborder', '0');
    iframe.style.width = '1px';
    iframe.style.minWidth = '100%';
    iframe.style.height = '800px'; // initial height; will auto-resize via postMessage
    iframe.style.border = '0';
    iframe.scrolling = 'no';
    iframe.src = src;

    container.innerHTML = '';
    container.appendChild(iframe);
  });
})();
