import React from 'react';
import PropTypes from 'prop-types';
import CSSModules from 'react-css-modules';

import Keys from '../../common/Keys'
import macros from './macros'
import DataLib from '../../common/classModels/DataLib'
import EmployeePanel from './panels/EmployeePanel';
import DesktopClassPanel from './panels/DesktopClassPanel';
import MobileClassPanel from './panels/MobileClassPanel';
import css from './ResultsLoader.css';

// The Home.js component now keeps track of how many to render. 
// This component watches for scroll events and tells Home.js if more items need to be requested. 

// Home page component
class ResultsLoader extends React.Component {

  constructor(props) {
    super(props);

    this.state = {
      visibleObjects: [],
    };


    // Number of results that were loaded when handleInfiniteLoad was called.
    // If handleInfiniteLoad is called two different times and the number of components is the same for both,
    // Assume that the first call is still processing and we can safety ignore the second call.
    // This prevents loading twice the number of elements in this case. 
    this.alreadyLoadedAt = {};

    this.handleInfiniteLoad = this.handleInfiniteLoad.bind(this);
  }

  componentDidMount() {
    window.addEventListener('scroll', this.handleInfiniteLoad);
    this.handleInfiniteLoad();
  }

  componentWillReceiveProps() {
    this.alreadyLoadedAt = {};
  }

  componentDidUpdate(prevProps, prevState) {
    if (prevProps.results !== this.props.results) {
      this.addMoreObjects();
    }
  }

  componentWillUnmount() {
    window.removeEventListener('scroll', this.handleInfiniteLoad);
  }

  handleInfiniteLoad() {
    if (this.props.results.length === 0) {
      return;
    }

    const resultsBottom = this.refs.elementsContainer.offsetHeight + this.refs.elementsContainer.offsetTop;

    const diff = window.scrollY + 2000 + window.innerHeight - resultsBottom;

    // Assume about 300 px per class
    if (diff > 0 && !this.alreadyLoadedAt[this.state.visibleObjects.length]) {
      this.alreadyLoadedAt[this.state.visibleObjects.length] = true;

      this.props.loadMore()
    }
  }

  addMoreObjects() {
    const newObjects = [];

    console.log('loading ', this.props.results.length)

    this.props.results.forEach((result) => {
      if (result.type === 'class') {

        let aClass;
        let hash = Keys.create(result.class).getHash()
        if (this.constructor.loadedClassObjects[hash]) {
          aClass = this.constructor.loadedClassObjects[hash]
        }
        else {
          aClass = DataLib.createClassFromSearchResult(result);
          this.constructor.loadedClassObjects[hash] = aClass;
        }

        newObjects.push({
          type: 'class',
          data: aClass,
        });
      } else if (result.type === 'employee') {
        newObjects.push({
          type: 'employee',
          data: result.employee,
        });
      } else {
        console.error('wtf is type', result.type);
      }
    });


    this.setState({
      visibleObjects: newObjects,
    });
  }


  render() {
    if (this.props.results.length === 0) {
      return null;
    }

    return (
      <div className={ `ui container ${css.resultsContainer}` }>
        <div className='five column row' >
          <div className='page-home' ref='elementsContainer'>
            {this.state.visibleObjects.map((obj) => {
              if (obj.type === 'class') {
                if (macros.isMobile) {
                  return <MobileClassPanel key={ Keys.create(obj.data).getHash() } aClass={ obj.data } />;
                }
                else {
                  return <DesktopClassPanel key={ Keys.create(obj.data).getHash() } aClass={ obj.data } />;
                }
              }
              else if (obj.type === 'employee') {
                return <EmployeePanel key = {obj.data.id} employee = {obj.data} />
              }
              else {
                console.log('Unknown type', obj.type)
                return null;
              }
            })}
          </div>
        </div>
      </div>
    );
  }
}

// Keep a cache of class objects that are already instantiated. 
// Don't need something similar for employees because there is no object that takes a couple ms to instantiate. 
ResultsLoader.loadedClassObjects = {}

ResultsLoader.propTypes = {
  results: PropTypes.array.isRequired
}


export default CSSModules(ResultsLoader, css);
