document.getElementById('uploadButton').addEventListener('click', function() {
  var fileInput = document.getElementById('fileInput');
  var file = fileInput.files[0];
  var downloadLink = document.getElementById('downloadLink');
  var progressBar = document.getElementById('progressBar');
  
  downloadLink.style.display = 'none'; // hide the download link

  if (!file) {
    alert('Please select a file!');
    return;
  }

  var reader = new FileReader();
  reader.onload = function(e) {
    var data = new Uint8Array(e.target.result);
    var zip = new JSZip();
    zip.loadAsync(data).then(function(docx) {
      var imageFiles = Object.keys(docx.files).filter(function(filename) { return filename.startsWith("word/media/"); });
      progressBar.max = imageFiles.length; // set the max value of the progress bar
      progressBar.value = 0; // reset the progress bar

      var imagePromises = imageFiles.map(function(filename, index) {
        return docx.file(filename).async("blob").then(function(fileData) {
          return new Promise((resolve, reject) => {
            let reader = new FileReader();
            reader.onload = event => resolve(event.target.result); // convert blob to ArrayBuffer
            reader.onerror = error => reject(error);
            reader.readAsArrayBuffer(fileData);
          })
          .then(arrayBuffer => Jimp.read(arrayBuffer))
          .then(function(image) {
            let darkPixels = 0;
            let totalPixels = image.bitmap.width * image.bitmap.height;

            image.scan(0, 0, image.bitmap.width, image.bitmap.height, function(x, y, idx) {
              let red = this.bitmap.data[idx + 0];
              let green = this.bitmap.data[idx + 1];
              let blue = this.bitmap.data[idx + 2];
              let brightness = (red * 0.3 + green * 0.59 + blue * 0.11) / 255;
              if (brightness < 0.5) {
                darkPixels++;
              }
            });

            if (darkPixels / totalPixels > 0.5) {
              image.invert();
            }

            return image.getBufferAsync(Jimp.AUTO);
          })
          .then(function(imageData) {
            docx.file(filename, imageData);
            progressBar.value += 1; // update the progress bar
          });
        });
      });

      Promise.all(imagePromises).then(function() {
        return docx.generateAsync({ type: "blob" });
      }).then(function(outputData) {
        var blobUrl = URL.createObjectURL(outputData);
        downloadLink.href = blobUrl;
        downloadLink.download = 'processed.docx';
        downloadLink.style.display = 'block'; // show the download link
      });
    });
  };
  reader.readAsArrayBuffer(file);
});
