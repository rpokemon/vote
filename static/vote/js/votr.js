var submission_data =  { responses: { } };

const setResponse = (id, value) => {
    submission_data.responses[`q${id}`] = value;
};

const responseSelectorTable = {
    bool: {
        radio: 'input[type="radio"]:checked',
        dropdown: 'select',
        default: 'input[type="radio"]:checked',
    },
    multi: {
    },
    int: {
    },
    text: {
    }
};

$(document).ready(function() {
    var activeQuestionPanel = $('section:first-of-type');

    // at presently only checks that a value is set
    const canMoveNextQuestion = (obj) => {
        var key = obj.attr('data-key');
        var form = `#question_form_${key}`;

        var resp_type = $(form).attr('data-response-type');
        var display_as = $(form).attr('data-display-as');
        var selector = responseSelectorTable[resp_type][display_as];

        var response = $(`${form} ${selector}`).val();
        var has_response = response  !== undefined;

        var button_id = `#question_next_${key}`;
        if (has_response) $(button_id).removeAttr('disabled');
        else $(button_id).attr('disabled');
    }

    $('.question_form').ready(function(e) {
        canMoveNextQuestion($(this));
    });

    $('.question_form').click(function(e) {
        canMoveNextQuestion($(this));
    });

    $('.question_form').keyup(function(e) {
        canMoveNextQuestion($(this));
    });

    $('.next-section').click(function(e) {
        activeQuestionPanel = $(this).parents('section').next();
        $('body').scrollTo(activeQuestionPanel, 1000, { easing: 'easeInOutQuint' });
    });

    $('.prev-section').click(function(e) {
        activeQuestionPanel = $(this).parents('section').prev();        
        $('body').scrollTo(activeQuestionPanel, 1000, { easing: 'easeInOutQuint' });
    });

    $('.record-response').click(function(e) {
        var key = $(this).attr('data-key');
        var form = `#question_form_${key}`;

        var resp_type = $(form).attr('data-response-type');
        var display_as = $(form).attr('data-display-as');
        var selector = responseSelectorTable[resp_type][display_as];

        if (!selector)
        {
            console.log(`Warning! No response selector defined for '${resp_type}' as '${display_as}'`);
            setResponse(key, 'ERR_NO_SELECTOR');
            return;
        }

        var response = $(`${form} ${selector}`).val();

        // response should only ever be undefined in the event that user clicks next having not provided a response
        // note that, when skipping, we insert null instead
        if (response === undefined)
            response = 'ERR_REQUIRED_RESPONSE_NOT_GIVEN';

        setResponse(key, response);
    });

    $('.skip-response').click(function(e) {
        var key = $(this).attr('data-key');
        setResponse(key, null);
    });

    $('.send-survey-response').click(function(e) {

        console.log(JSON.stringify(submission_data.responses));

        $.ajax({
            url: '/vote/ui_test/response',
            type: 'POST',
            data: JSON.stringify(submission_data),
            contentType: "application/json; charset=utf-8",

            success: (data, textStatus, jqXHR) => {
                $('#submissionResponseModalTitle').html("Responses Received!");
                $('#submissionResponseModalMessage').html("That's that, all done! We've received your responses to this survey and they have been stored securely. For security reasons your session will be ended.");
                $('#submissionResponseModal').modal('show');
            },

            error: (jqXHR, textStatus, errorThrown) => {
                $('#submissionResponseModalTitle').html("Something Went Wrong...");

                var errStr = "";
                switch(jqXHR.status) {
                    case 400:
                        errStr = "The response table was incorrectly formed. This likely indicates a bug in the software and should be reported to the r/Pokemon team (400 BAD REQUEST).";
                        break;
                    case 401:
                        errStr = "Our server does not have a record of your session authorisation, indicating you have either already completed this survey or have clicked 'decline' when asked to authorise your account (401 UNAUTHORIZED).";
                        break;
                    case 409:
                        errStr = "The response table was too short, too long, or contained response entries that do not match the required type or format (409 CONFLICT).";
                    default:
                        errStr = `Unknown failure (${jqXHR.status} ${textStatus.toUpperCase()}).`;
                        break;
                }

                $('#submissionResponseModalMessage').html(`Unfortunately an issue occured during transmission of your responses: ${errStr}`);
                $('#submissionResponseModal').modal('show');
            }
        })
    });
    
    var resizeTimeout;
    $(window).resize(() => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            $('body').scrollTo(activeQuestionPanel, 0);
        }, 50);
    });
});
