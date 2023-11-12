import React from 'react'

const ImageComponent = (props) => {
    const { record, property } = props

    return <img src={record.params[property.name]} alt='Custom Image' style={{ maxWidth: '100%' }} />
}

export default ImageComponent
