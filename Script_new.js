"use strict";
const modelViewerVariants = document.querySelector("model-viewer#Glass");

const urlParams = new URLSearchParams(window.location.search);
let CatalogKey = "TABLES01";
if(urlParams.get('ProjectKey') != null)
  CatalogKey = urlParams.get('ProjectKey');

let catalog;

let response = new Promise(function (resolve, reject) {
  fetch('http://localhost:3000/data', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json;charset=UTF-8'
    },
    body: JSON.stringify({CatalogKey})
  })
  .then(response => response.text())
  .then(data => {
    console.log(data);
    resolve(data);
  })
  .catch(error => {
    console.error(error);
  });
});

response.then(data => {
    catalog = JSON.parse(data);
    addModelButtons()
    ChangeModel(catalog[0].Models[0].ModelLink, catalog[0].Models[0].ModelName)
});

function addModelButtons() {
    for (var k in catalog) {
        for (var n in catalog[k].Models) {
            const NewButton = document.createElement('button');
            const NewImage = document.createElement('img');
            NewButton.setAttribute('id', catalog[k].Models[n].ModelName);
            NewImage.setAttribute('src', catalog[k].Models[n].TumbnailLink);
            NewButton.append(NewImage);

            let ModelLink = catalog[k].Models[n].ModelLink;
            NewButton.addEventListener('click', function() {
              ChangeModel(ModelLink, this.id);
            });

            const InsertInto = document.getElementById("Models");
            InsertInto.appendChild(NewButton);
        }
    }
}

function AddMaterialVariantsButtons(ModelName)
{
  var ModelIndex =  catalog[0].Models.findIndex(obj => obj.ModelName == ModelName);

  if(catalog[0].Models[ModelIndex].MaterialVariants != null)
  {
    if(catalog[0].Models[ModelIndex].MaterialVariants[0] != null)
    {
      for(var p in catalog[0].Models[ModelIndex].MaterialVariants)
      {
        const NewButton = document.createElement('button');
        const NewImage = document.createElement('img');
        NewButton.setAttribute('id', catalog[0].Models[ModelIndex].MaterialVariants[p].MateriaVariantName);
        NewImage.setAttribute('src', catalog[0].Models[ModelIndex].MaterialVariants[p].MaterialVariantLink);
        NewButton.append(NewImage);
  
        NewButton.addEventListener('click', function() {
          ChangeVariant(this.id);
        });
      
        const InsertInto = document.getElementById("MaterialVariants");
        InsertInto.appendChild(NewButton);
      }
    }
  }
}

function ChangeModel(ModelLink, id)
{
    modelViewerVariants.src = ModelLink;
    const DelFrom = document.getElementById("MaterialVariants");
    DelFrom.innerHTML = '';
    AddMaterialVariantsButtons(id);
}

function ChangeVariant(id)
{
  modelViewerVariants.variantName = id;
}

//Слайдеры
modelViewerVariants.addEventListener('load', () => {
  var controls = document.getElementById("AnimControls");
  var slider = document.getElementById("myRange");
  if((modelViewerVariants.availableAnimations.length === 0) === true)
  {
      slider.value = 0.01;
      controls.setAttribute("hidden",""); 
  }
  else
  {
      slider.value = 0.01;
      modelViewerVariants.play();
      modelViewerVariants.pause(); 
      controls.removeAttribute("hidden");
  }
});

var play = false;
function PlayPause()
{
  if(play === false)
  {
      play = true;
      Glass.play();
  }
  else
  {
      play = false;
      Glass.pause();
  }
}

AnimSlider();

function AnimSlider()
{
var slider = document.getElementById("myRange");
slider.oninput = function()
{
  modelViewerVariants.currentTime = slider.value/99.98*modelViewerVariants.duration;
}
}

const interval = setInterval(function() 
{
var slider = document.getElementById("myRange");
if (modelViewerVariants.paused == false)
{
  slider.value = modelViewerVariants.currentTime/modelViewerVariants.duration*99.98;
}
}, 30);