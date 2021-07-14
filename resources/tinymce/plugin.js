/**
 * Add Footnote Shortcode
 *
 * @package mcaskill/wp-simple-footnotes
 *
 * @author Chauncey McAskill
 * @link  https://github.com/mcaskill/wp-simple-footnotes
 * @author Andrew Patton
 * @link  https://wordpress.org/extend/plugins/simple-footnotes-editor-button/
 */
( function ( tinymce, wp ) {
    'use strict';

    /**
     * @property {string}          PLUGIN_NAME   - The TinyMCE plugin name.
     * @property {string}          SHORTCODE_TAG - The WordPress shortcode tag.
     * @property {?object[]}       globalNotes   - A list of central notes to pick from.
     * @property {?tinymce.Editor} activeEditor  - Currently active editor instance.
     */
    var Footnotes = {
        PLUGIN_NAME:           'simple_footnotes',
        SHORTCODE_TAG:         'ref',
        AJAX_GET_GLOBAL_NOTES: 'simple_footnotes_get_global_notes',

        globalNotes:    null,
        useGlobalNotes: true,

        /**
         * Retrieves the list of notes.
         *
         * @return {object[]}
         */
        getCentralList: function () {
            return this.globalNotes || [];
        },

        /**
         * Fetches the list of notes from the server.
         *
         * @return {wp.ajax}
         */
        fetchCentralList: function () {
            var that = this;

            if ( ! this.useGlobalNotes ) {
                return $.Deferred();
            }

            return wp.ajax.post( this.AJAX_GET_GLOBAL_NOTES )
                .done( function ( response ) {
                    that.globalNotes = response.notes;
                } )
                .fail( function () {
                    that.globalNotes = [];
                } );
        },

        /**
         * Finds the matching shortcode in text.
         *
         * @param  {tinymce.Editor} editor - The related editor instance.
         * @param  {?string}        [text] - The text to search.
         *     If omitted, the current text selection is searched.
         * @return {?wp.shortcode}
         */
        getShortcodeFrom: function ( editor, text ) {
            if ( typeof text === 'undefined' ) {
                text = editor.selection.getContent();
            }

            if ( text.length ) {
                var shortcode = wp.shortcode.next( this.SHORTCODE_TAG, text );

                if ( shortcode ) {
                    // Ignore the rest of the match object.
                    return shortcode.shortcode;
                }
            }

            return null;
        },

        /**
         * Retrieves the TinyMCE toolbar button settings.
         *
         * @param  {tinymce.Editor} editor - The related editor instance.
         * @return {object}
         */
        getToolbarButtonSettings: function ( editor ) {
            return {
                title:   editor.getLang( this.PLUGIN_NAME + '.buttonLabel' ),
                icon:    'anchor',
                classes: 'btn-' + this.PLUGIN_NAME.replace( '_', '-' ),
                onClick: this.handleDialogOpen.bind( this, editor )
            };
        },

        /**
         * Retrieves the TinyMCE window settings.
         *
         * @param  {tinymce.Editor} editor - The related editor instance.
         * @return {object}
         */
        getDialogSettings: function ( editor ) {
            return {
                title:    editor.getLang( this.PLUGIN_NAME + '.dialogTitle' ),
                body:     [],
                height:   ( this.useGlobalNotes ? 244 : 214 ),
                width:    480,
                onSubmit: this.handleDialogSubmit.bind( this, editor )
            };
        },

        /**
         * Opens a TinyMCE window.
         *
         * @listens tinymce:button:click
         *
         * @param  {tinymce.Editor} editor - The related editor instance.
         * @return {void}
         */
        openDialog: function ( editor ) {
            var dialogSettings = this.getDialogSettings( editor );

            if ( this.useGlobalNotes ) {
                dialogSettings.body.push( {
                    type:  'label',
                    forId: 'id',
                    text:  editor.getLang( this.PLUGIN_NAME + '.idLabel' ),
                } );
                dialogSettings.body.push( this.createNoteIdFormControlSettings( editor ) );
            }

            dialogSettings.body.push( {
                type:  'label',
                forId: 'note',
                text:  editor.getLang( this.PLUGIN_NAME + ( this.useGlobalNotes ? '.orTextLabel' : '.textLabel' ) ),
            } );
            dialogSettings.body.push( this.createNoteTextFormControlSettings( editor ) );
            dialogSettings.body.push( this.createNotePreviewFormControlSettings( editor ) );
            dialogSettings.body.push( this.createNoteHideFormControlSettings( editor ) );

            editor.windowManager.open( dialogSettings );
        },

        /**
         * Creates the TinyMCE form control settings for the menu of Note ID options.
         *
         * @param  {tinymce.Editor} editor - The related editor instance.
         * @return {object}
         */
        createNoteIdFormControlSettings: function ( editor ) {
            var noteIdCtrl, globalNotes, selectedNoteId, shortcode;

            shortcode      = this.getShortcodeFrom( editor );
            selectedNoteId = ( shortcode && shortcode.get('id') || null );
            globalNotes      = this.getCentralList();

            if ( Array.isArray( globalNotes ) && globalNotes.length ) {
                noteIdCtrl = {
                    name:   'id',
                    type:   'listbox',
                    // label:  editor.getLang( this.PLUGIN_NAME + '.idLabel' ),
                    value:  selectedNoteId,
                    values: globalNotes.map( function ( note ) {
                        return {
                            text:  ( note.text.length > 35 ? note.text.substr( 0, 40 ) + '…' : note.text ),
                            value: note.id
                        };
                    } ),
                    onShow: function (event) {
                        try {
                            event.control.$el[0].style.maxHeight = '200px';
                        } catch (err) {
                            // do nothing
                        }
                    }
                };

                noteIdCtrl.values.unshift( {
                    text:  ( '— ' + editor.getLang( this.PLUGIN_NAME + '.idPlaceholder' ) + ' —' ),
                    value: null
                } );
            } else {
                noteIdCtrl = {
                    name:  'id',
                    type:  'textbox',
                    // label:  editor.getLang( this.PLUGIN_NAME + '.idLabel' ),
                    value: selectedNoteId
                };
            }

            return noteIdCtrl;
        },

        /**
         * Creates the TinyMCE form control settings for the Note text field.
         *
         * @param  {tinymce.Editor} editor - The related editor instance.
         * @return {object}
         */
        createNoteTextFormControlSettings: function ( editor ) {
            var textCtrl, selectedText, shortcode;

            shortcode    = this.getShortcodeFrom( editor );
            selectedText = ( shortcode && shortcode.get('note') || null );

            textCtrl = {
                name:      'note',
                type:      'textbox',
                // label:     editor.getLang( this.PLUGIN_NAME + '.textLabel' ),
                rows:      3,
                multiline: true,
                autofocus: ! this.useGlobalNotes,
                value:     selectedText
            };

            return textCtrl;
        },

        /**
         * Creates the TinyMCE form control settings for the Note preview checkbox.
         *
         * @param  {tinymce.Editor} editor - The related editor instance.
         * @return {object}
         */
        createNotePreviewFormControlSettings: function ( editor ) {
            var previewCtrl, checked, shortcode;

            shortcode = this.getShortcodeFrom( editor );
            checked   = ( ( shortcode && ( shortcode.attrs.numeric.indexOf('preview') > -1 ) ) || false );

            console.log('shortcode:', shortcode);

            previewCtrl = {
                name:      'preview',
                type:      'checkbox',
                checked:   checked,
                text:      editor.getLang( this.PLUGIN_NAME + '.previewLabel' )
            };

            return previewCtrl;
        },

        /**
         * Creates the TinyMCE form control settings for the Note hidden checkbox.
         *
         * @param  {tinymce.Editor} editor - The related editor instance.
         * @return {object}
         */
        createNoteHideFormControlSettings: function ( editor ) {
            var hideCtrl, checked, shortcode;

            shortcode = this.getShortcodeFrom( editor );
            checked   = ( ( shortcode && ( shortcode.attrs.numeric.indexOf('hidden') > -1 ) ) || false );

            hideCtrl = {
                name:      'hidden',
                type:      'checkbox',
                checked:   checked,
                text:      editor.getLang( this.PLUGIN_NAME + '.hiddenLabel' )
            };

            return hideCtrl;
        },

        /**
         * Handles the opening of a TinyMCE window.
         *
         * @listens tinymce:button:click
         *
         * @param  {tinymce.Editor} editor - The related editor instance.
         * @param  {tinymce.Event}  event  - The click event instance.
         * @return {void}
         */
        handleDialogOpen: function ( editor, event ) {
            var that = this,
                selection = editor.selection.getContent();

            // Bail if we don't have any selection
            /*if ( 0 === selection.length ) {
                alert( editor.getLang( this.PLUGIN_NAME + '.selectionRequired' ) );
                return;
            }*/

            if ( ! this.useGlobalNotes || Array.isArray( this.globalNotes ) ) {
                this.openDialog( editor );
            } else {
                // $spinner.addClass( 'is-active' );

                this.fetchCentralList().always( function () {
                    // $spinner.removeClass( 'is-active' );
                    that.openDialog( editor );
                } );
            }
        },

        /**
         * Handles when the TinyMCE window form is submitted.
         *
         * @listens tinymce:window:submit
         *
         * @param  {tinymce.Editor} editor - The related editor instance.
         * @param  {tinymce.Event}  event  - The submit event instance.
         * @return {void}
         */
        handleDialogSubmit: function ( editor, event ) {
            var html,
                content,
                shortcode,
                remove = true,
                attrs = {
                    named:   {},
                    numeric: []
                };

            console.log( 'data:', event.data );

            content   = editor.selection.getContent();
            shortcode = this.getShortcodeFrom( editor, content );
            if ( shortcode ) {
                content = shortcode.content;
            }

            console.log( 'content:', content );

            if ( event.data.id ) {
                attrs.named.id = event.data.id;
                remove = false;
            } else if ( event.data.note && ( typeof event.data.note === 'string' ) ) {
                event.data.note = event.data.note.trim();

                if ( event.data.note ) {
                    attrs.named.note = event.data.note;
                    remove = false;
                }
            }

            /*if ( event.data.mark && ( typeof event.data.mark === 'string' ) ) {
                event.data.mark = event.data.mark.trim();

                if ( event.data.mark ) {
                    attrs.named.mark = event.data.mark;
                }
            }*/

            if ( event.data.preview && ( typeof event.data.preview === 'boolean' ) ) {
                attrs.numeric.push('preview');
            }

            if ( event.data.hidden && ( typeof event.data.hidden === 'boolean' ) ) {
                attrs.numeric.push('hidden');
            }

            console.log( 'attrs:', attrs );

            if ( remove ) {
                html = content;
            } else if ( ! attrs.named.id && ! event.data.note ) {
                alert( editor.getLang( this.PLUGIN_NAME + '.idRequired' ) );
                return false;
            } else {
                html = wp.shortcode.string( {
                    type:    ( content ? 'closed' : 'single' ),
                    tag:     Footnotes.SHORTCODE_TAG,
                    attrs:   attrs,
                    content: content
                } );
            }

            editor.undoManager.transact( function () {
                editor.selection.setContent( html );
                editor.nodeChanged();
            });
        }
    };

    tinymce.PluginManager.add( Footnotes.PLUGIN_NAME, function ( editor, url ) {
         editor.addButton( Footnotes.PLUGIN_NAME, Footnotes.getToolbarButtonSettings( editor ) );
    } );
} )( window.tinymce, window.wp );
