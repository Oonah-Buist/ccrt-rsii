// Simple JotForm embed for Contact page
(function(){
  document.addEventListener('DOMContentLoaded', function(){
    var container = document.getElementById('contactFormEmbed');
    if (!container) return;

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
    container.innerHTML = '<iframe title="Contact form" style="width:1px; min-width:100%; height:800px; border:0;" frameborder="0" allow="geolocation; microphone; camera;" src="'+src+'"></iframe>';
  });
})();
