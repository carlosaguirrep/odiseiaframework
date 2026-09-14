


  document.onreadystatechange = function () {
    if (document.readyState == "complete") {
      
        const switchery = document.querySelectorAll('.switch-input');

        switchery.forEach(element => {
            if(element.value == 1){
                element.checked = true;
            }
        });
    }
  };


  document.querySelectorAll('.switch-input').forEach(element => {
    element.addEventListener('change', function(e) {
        console.log(this)
        if (!this.checked) {
            element.value = 0;
        }else{
          element.value = 1;
        }
      });
  });