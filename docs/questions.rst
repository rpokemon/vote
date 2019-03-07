.. raw:: html

    <style> iframe { 
        height: 300px;
        width: calc(100% - 64px);
        box-shadow: 0px 8px 16px rgba(0,0,0,0.26); 
        border-radius: 8px; padding: 32px 
    } </style>

Survey Questions
================

The following outlines the various types of question supported. as well as
example configuration for each.

Multiple Choice
---------------

.. raw:: html

   <iframe src="/vote/sample/bool_radio" frameborder="0" scrolling="no"  height="280px"></iframe>
    
Configuration
~~~~~~~~~~~~~

.. literalinclude:: ../samples/bool_radio.json

`response_type` Should always be set to `bool` for multiple choice questions.

The `response_scale` defines the options to select from.

Dropdown
--------

.. raw:: html

   <iframe src="/vote/sample/bool_dropdown" frameborder="0" scrolling="no"  height="280px"></iframe>
    
Configuration
~~~~~~~~~~~~~

.. literalinclude:: ../samples/bool_dropdown.json

`response_type` Should always be set to `bool` for dropdown questions.

The `display_as` field must bet set to `dropdown` for dropdown questions.

The `response_scale` defines the options to select from.

Checkboxes
----------

.. raw:: html

   <iframe src="/vote/sample/multi" frameborder="0" scrolling="no"  height="280px"></iframe>
    
Configuration
~~~~~~~~~~~~~

.. literalinclude:: ../samples/multi.json

`response_type` Should always be set to `multi` for checkbox questions.

The `required` field must hold the minimum number of checkboxes to be selected.

The `response_scale` defines the options to select from.

Ranked Choice
-------------

.. raw:: html

   <iframe src="/vote/sample/rank" frameborder="0" scrolling="no"  height="280px"></iframe>
    
Configuration
~~~~~~~~~~~~~

.. literalinclude:: ../samples/rank.json

`response_type` Should always be set to `rank` for ranked choice questions.

The `response_scale` defines the options to select from.

Linear Scale
------------

.. raw:: html

   <iframe src="/vote/sample/int" frameborder="0" scrolling="no"  height="280px"></iframe>

Configuration
~~~~~~~~~~~~~

.. literalinclude:: ../samples/int.json

`response_type` Should always be set to `int` for linear scale questions.

The `response_scale` defines the minimum and maximum of the scale.


Paragraph
---------

.. raw:: html

   <iframe src="/vote/sample/text" frameborder="0" scrolling="no"  height="280px"></iframe>
    
Configuration
~~~~~~~~~~~~~

.. literalinclude:: ../samples/text.json

`response_type` Should always be set to `text` for paragraph questions.

The `response_scale` defines the minimum and maximum length of the response.

miniumum and maximum must be defined as a number followed by either:
 - `c` for characters
 - `w` for words