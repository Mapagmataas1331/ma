import React from 'react'
import ReactDOM from 'react-dom/client'
import Header from '../../assets/templates/header'
import Struct from '../../assets/templates/struct'
import './404.scss'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Header />
    <h1>404</h1>
    <Struct />
  </React.StrictMode>
)
