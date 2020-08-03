module.exports = (code) => {
  return `
    <html>
      <head>
        <script src="/bundle.js"></script>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/twitter-bootstrap/4.5.0/css/bootstrap.min.css">
        <style>
          body {
            margin: 5px;
          }
        </style>
      </head>
      <body>
        <div style="color: red;" id="err"></div>
        <div id="root"></div>
        <script>
          try {
            ${code}
          } catch (err) {
            document.querySelector('#err').innerHTML = err.message;
          }
        </script>
      </body>
    </html>
  `;
};
